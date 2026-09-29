<?php

namespace App\Modules\Shared\Services;

use App\Modules\Admin\Models\AdminAuditLog;
use App\Modules\Shared\Exceptions\ImageProcessingFailedException;
use App\Modules\Shared\Exceptions\ImageProcessorUnavailableException;
use Exception;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SafeImageUploadService
{
    public const MAX_WIDTH = 4096;
    public const MAX_HEIGHT = 4096;
    public const MAX_PIXELS = 16777216; // 4096 * 4096

    public const ALLOWED_MIME_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    /**
     * Verifies that the server has GD installed with JPEG, PNG, and WebP support.
     *
     * @return array{available: bool, reason: ?string, formats: array<string, bool>, version: string}
     */
    public static function verifyImageProcessorSupport(): array
    {
        if (!extension_loaded('gd')) {
            return [
                'available' => false,
                'reason' => 'GD extension is not loaded in the PHP runtime environment.',
                'formats' => [
                    'jpeg' => false,
                    'png' => false,
                    'webp' => false,
                ],
                'version' => 'unavailable',
            ];
        }

        $gdInfo = gd_info();
        $jpeg = !empty($gdInfo['JPEG Support']) || !empty($gdInfo['JPG Support']);
        $png = !empty($gdInfo['PNG Support']);
        $webp = !empty($gdInfo['WebP Support']);

        $allSupported = $jpeg && $png && $webp;
        $reason = $allSupported ? null : 'Missing format support in GD (JPEG, PNG, and WebP are strictly required).';

        return [
            'available' => $allSupported,
            'reason' => $reason,
            'formats' => [
                'jpeg' => $jpeg,
                'png' => $png,
                'webp' => $webp,
            ],
            'version' => (string) ($gdInfo['GD Version'] ?? 'unknown'),
        ];
    }

    /**
     * Validates binary content, enforces dimension constraints, re-encodes
     * image to strip metadata/polyglots, verifies the generated output,
     * and atomically saves with a UUID filename outside public storage staging.
     *
     * Under NO circumstances will an un-re-encoded or fallback copy of the original
     * uploaded file be published to the public filesystem.
     *
     * @param UploadedFile $file The raw uploaded file
     * @param string $subfolder Subfolder inside uploads (e.g. 'products', 'blog', 'site-media')
     * @param int $maxSizeBytes Maximum allowed file size in bytes
     * @return array{filename: string, url: string, width: int, height: int, mime: string}
     *
     * @throws ValidationException
     * @throws ImageProcessorUnavailableException
     * @throws ImageProcessingFailedException
     */
    public static function processAndStore(
        UploadedFile $file,
        string $subfolder,
        int $maxSizeBytes = 6291456
    ): array {
        // 1. Enforce file size limit
        if ($file->getSize() > $maxSizeBytes) {
            $maxMb = round($maxSizeBytes / (1024 * 1024), 1);
            throw ValidationException::withMessages([
                'image' => ["حجم تصویر نمی‌تواند بیشتر از {$maxMb} مگابایت باشد."],
            ]);
        }

        $realPath = $file->getRealPath();
        if (!$realPath || !file_exists($realPath)) {
            throw ValidationException::withMessages([
                'image' => ['فایل بارگذاری شده نامعتبر است.'],
            ]);
        }

        // 2. Controlled check for GD processor availability and required formats
        $processor = self::verifyImageProcessorSupport();
        if (!$processor['available']) {
            Log::error('[SECURITY_AUDIT] Image upload rejected: Image processor unavailable or missing formats', [
                'reason' => $processor['reason'],
                'formats' => $processor['formats'],
                'ip' => request()->ip(),
            ]);

            throw new ImageProcessorUnavailableException(
                'سرویس پردازش و ایمن‌سازی تصویر در دسترس نیست یا فرمت‌های لازم فعال نشده‌اند.'
            );
        }

        // 3. Binary inspection via finfo (never trust client-supplied MIME or extension)
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $detectedMime = finfo_file($finfo, $realPath);
        finfo_close($finfo);

        if (!array_key_exists($detectedMime, self::ALLOWED_MIME_TYPES)) {
            Log::warning('[SECURITY_AUDIT] Attempted upload of unauthorized MIME type', [
                'detected_mime' => $detectedMime,
                'client_mime' => $file->getClientMimeType(),
                'original_name' => $file->getClientOriginalName(),
                'ip' => request()->ip(),
            ]);

            throw ValidationException::withMessages([
                'image' => ['تنها فرمت‌های تصویری JPEG، PNG و WebP مجاز هستند. فرمت‌های اسکریپت‌پذیر (نظیر SVG) پذیرفته نمی‌شوند.'],
            ]);
        }

        // 4. Binary inspection via getimagesize (confirms real image payload & dimensions)
        // Strict: no test bypasses. Security tests must supply real image fixtures.
        $imageInfo = @getimagesize($realPath);
        if ($imageInfo === false) {
            throw ValidationException::withMessages([
                'image' => ['محتوای فایل تصویر نامعتبر یا فاسد است.'],
            ]);
        }

        [$width, $height, $imageType] = $imageInfo;

        // Strictly verify GD image type matches allowed types
        $validGdTypes = [IMAGETYPE_JPEG, IMAGETYPE_PNG];
        if (defined('IMAGETYPE_WEBP')) {
            $validGdTypes[] = IMAGETYPE_WEBP;
        }

        if (!in_array($imageType, $validGdTypes, true)) {
            throw ValidationException::withMessages([
                'image' => ['نوع فایل تصویر پشتیبانی نمی‌شود.'],
            ]);
        }

        // Verify detected MIME strictly corresponds to getimagesize type
        $expectedType = match ($detectedMime) {
            'image/jpeg' => IMAGETYPE_JPEG,
            'image/png' => IMAGETYPE_PNG,
            'image/webp' => defined('IMAGETYPE_WEBP') ? IMAGETYPE_WEBP : 18,
            default => -1,
        };

        if ($imageType !== $expectedType) {
            throw ValidationException::withMessages([
                'image' => ['عدم تطابق نوع تصویر با امضای باینری فایل.'],
            ]);
        }

        // 5. Dimension & pixel count constraints (prevent decompression bomb attacks)
        if ($width <= 0 || $height <= 0 || $width > self::MAX_WIDTH || $height > self::MAX_HEIGHT || ($width * $height) > self::MAX_PIXELS) {
            throw ValidationException::withMessages([
                'image' => ["ابعاد تصویر فراتر از حد مجاز است (حداکثر ابعاد: ".self::MAX_WIDTH."x".self::MAX_HEIGHT." پیکسل)."],
            ]);
        }

        // 6. Determine target extension purely from detected binary MIME (never client original)
        $serverExt = self::ALLOWED_MIME_TYPES[$detectedMime];
        $uuidFilename = Str::uuid()->toString() . '.' . $serverExt;

        // 7. Resolve safe, persistent storage directory
        // Supports explicit external persistent storage path via UPLOADS_STORAGE_PATH env,
        // standard shared hosting (outside deployment code release: /home/USER/public_html/uploads),
        // or local public_path('uploads').
        $customUploadsRoot = config('filesystems.uploads_path', env('UPLOADS_STORAGE_PATH'));
        if (!empty($customUploadsRoot) && is_dir($customUploadsRoot)) {
            $uploadsRoot = rtrim($customUploadsRoot, DIRECTORY_SEPARATOR);
        } else {
            $sharedHostingPublicRoot = dirname(base_path()) . DIRECTORY_SEPARATOR . 'public_html';
            $publicRoot = is_dir($sharedHostingPublicRoot) ? $sharedHostingPublicRoot : public_path();
            $uploadsRoot = $publicRoot . DIRECTORY_SEPARATOR . 'uploads';
        }

        $targetDirectory = $uploadsRoot . DIRECTORY_SEPARATOR . $subfolder;
        File::ensureDirectoryExists($targetDirectory, 0755, true);

        // Ensure hardened .htaccess exists in uploads directory
        self::ensureHardenedHtaccess($uploadsRoot);

        $destinationPath = $targetDirectory . DIRECTORY_SEPARATOR . $uuidFilename;

        // 8. Staging outside public storage:
        // Raw upload is held in PHP temporary directory outside public storage.
        // We re-encode into a staging file located outside public directory.
        $stagingDir = storage_path('app' . DIRECTORY_SEPARATOR . 'tmp_uploads');
        if (!is_dir($stagingDir)) {
            @mkdir($stagingDir, 0700, true);
        }
        $stagingPath = $stagingDir . DIRECTORY_SEPARATOR . 'stage_' . Str::uuid()->toString() . '.' . $serverExt;

        try {
            // Server-side Re-encoding: Strip EXIF metadata, ICC profiles, comments, and polyglots
            $reEncoded = self::reEncodeImage($realPath, $stagingPath, $imageType);

            if (!$reEncoded || !file_exists($stagingPath) || filesize($stagingPath) === 0) {
                if (file_exists($stagingPath)) {
                    @unlink($stagingPath);
                }
                throw new ImageProcessingFailedException('خطا در رمزگشایی یا بازتولید امن تصویر. فایل ذخیره نشد.');
            }

            // 9. Re-open generated output and verify its actual MIME, dimensions, and GD decodability
            self::verifyGeneratedOutput($stagingPath, $detectedMime, $imageType);

            // 10. Atomic publish to destination storage (only after successful verification)
            if (!@rename($stagingPath, $destinationPath)) {
                if (!@copy($stagingPath, $destinationPath)) {
                    @unlink($stagingPath);
                    throw new ImageProcessingFailedException('انتقال نهایی فایل ایمن‌سازی شده ناموفق بود.');
                }
                @unlink($stagingPath);
            }

            // Discard original raw upload immediately
            @unlink($realPath);

            // Set safe file permissions (read-only for group/others, non-executable)
            @chmod($destinationPath, 0644);
        } catch (\Throwable $e) {
            // Delete any partial staging or destination files on failure
            if (file_exists($stagingPath)) {
                @unlink($stagingPath);
            }
            if (file_exists($destinationPath)) {
                @unlink($destinationPath);
            }
            throw $e;
        }

        $publicUrl = url("uploads/{$subfolder}/{$uuidFilename}");

        // 11. Record audit log for administrative file upload
        try {
            if (auth()->check()) {
                AdminAuditLog::create([
                    'user_id' => auth()->id(),
                    'action' => 'IMAGE_UPLOAD',
                    'auditable_type' => 'Media',
                    'auditable_id' => 0,
                    'old_values' => null,
                    'new_values' => [
                        'filename' => $uuidFilename,
                        'subfolder' => $subfolder,
                        'width' => $width,
                        'height' => $height,
                        'mime' => $detectedMime,
                        'size' => filesize($destinationPath),
                    ],
                    'ip_address' => request()->ip(),
                    'user_agent' => substr((string) request()->userAgent(), 0, 255),
                ]);
            }
        } catch (\Throwable $e) {
            // Non-blocking audit log catch
        }

        return [
            'filename' => $uuidFilename,
            'url' => $publicUrl,
            'width' => $width,
            'height' => $height,
            'mime' => $detectedMime,
        ];
    }

    /**
     * Re-opens the generated output to verify actual MIME, dimensions, and GD decodability
     * before publishing.
     *
     * @throws ImageProcessingFailedException
     */
    protected static function verifyGeneratedOutput(string $outputPath, string $expectedMime, int $expectedImageType): void
    {
        if (!file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new ImageProcessingFailedException('فایل خروجی تولید شده نامعتبر یا خالی است.');
        }

        // 1. Verify actual MIME of the generated output
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $outputMime = finfo_file($finfo, $outputPath);
        finfo_close($finfo);

        if ($outputMime !== $expectedMime) {
            throw new ImageProcessingFailedException('نوع باینری فایل بازتولید شده با فرمت مجاز مطابقت ندارد.');
        }

        // 2. Verify dimensions and type of the generated output
        $outputInfo = @getimagesize($outputPath);
        if ($outputInfo === false) {
            throw new ImageProcessingFailedException('هدر تصویر بازتولید شده نامعتبر است.');
        }

        [$outWidth, $outHeight, $outType] = $outputInfo;
        if ($outWidth <= 0 || $outHeight <= 0 || $outWidth > self::MAX_WIDTH || $outHeight > self::MAX_HEIGHT || ($outWidth * $outHeight) > self::MAX_PIXELS) {
            throw new ImageProcessingFailedException('ابعاد فایل بازتولید شده فراتر از حد مجاز است.');
        }

        if ($outType !== $expectedImageType) {
            throw new ImageProcessingFailedException('نوع داده باینری فایل بازتولید شده نامعتبر است.');
        }

        // 3. Verify decodability by re-opening with GD decoder
        $verifyResource = match ($outType) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($outputPath),
            IMAGETYPE_PNG => @imagecreatefrompng($outputPath),
            defined('IMAGETYPE_WEBP') && $outType === IMAGETYPE_WEBP => @imagecreatefromwebp($outputPath),
            default => false,
        };

        if (!$verifyResource) {
            throw new ImageProcessingFailedException('فایل بازتولید شده توسط رمزگشای تصویر قابل بارگذاری نیست.');
        }

        imagedestroy($verifyResource);
    }

    /**
     * Re-encodes image via GD to strip active payloads, EXIF, and polyglots.
     */
    protected static function reEncodeImage(string $sourcePath, string $targetPath, int $imageType): bool
    {
        if (!extension_loaded('gd')) {
            return false;
        }

        try {
            $image = match ($imageType) {
                IMAGETYPE_JPEG => @imagecreatefromjpeg($sourcePath),
                IMAGETYPE_PNG => @imagecreatefrompng($sourcePath),
                defined('IMAGETYPE_WEBP') && $imageType === IMAGETYPE_WEBP => @imagecreatefromwebp($sourcePath),
                default => false,
            };

            if (!$image) {
                return false;
            }

            $success = false;
            if ($imageType === IMAGETYPE_PNG) {
                imagealphablending($image, false);
                imagesavealpha($image, true);
                $success = @imagepng($image, $targetPath, 8);
            } elseif (defined('IMAGETYPE_WEBP') && $imageType === IMAGETYPE_WEBP) {
                $success = @imagewebp($image, $targetPath, 85);
            } else {
                $success = @imagejpeg($image, $targetPath, 85);
            }

            imagedestroy($image);
            return $success && file_exists($targetPath) && filesize($targetPath) > 0;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Ensures uploads directory cannot execute PHP or scripts under Apache.
     */
    protected static function ensureHardenedHtaccess(string $uploadsRoot): void
    {
        $htaccessPath = $uploadsRoot . DIRECTORY_SEPARATOR . '.htaccess';
        if (!file_exists($htaccessPath)) {
            $content = <<<'HTACCESS'
Options -ExecCGI -Indexes
RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phps .cgi .pl .asp .aspx .shtml
RemoveType .php .phtml .php3 .php4 .php5 .php7 .php8 .phps .cgi .pl .asp .aspx .shtml

<IfModule mod_php.c>
    php_flag engine off
</IfModule>
<IfModule mod_php7.c>
    php_flag engine off
</IfModule>
<IfModule mod_php8.c>
    php_flag engine off
</IfModule>

SetHandler default-handler

<FilesMatch "\.(php[0-9]?|phtml|phps|cgi|pl|sh|bash|py|rb|js|html|htm|shtml|svg|xml|exe|bin|bat|phar)$">
    Order allow,deny
    Deny from all
</FilesMatch>

<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set Content-Security-Policy "default-src 'none'; sandbox"
    Header set X-Frame-Options "DENY"
    Header set Content-Disposition "inline"
</IfModule>
HTACCESS;
            @file_put_contents($htaccessPath, $content);
        }
    }
}
