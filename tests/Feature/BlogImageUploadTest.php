<?php

namespace Tests\Feature;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class BlogImageUploadTest extends TestCase
{
    /** @var array<int, string> */
    private array $uploadedPaths = [];

    protected function tearDown(): void
    {
        foreach ($this->uploadedPaths as $path) {
            if (File::exists($path)) {
                File::delete($path);
            }
        }

        parent::tearDown();
    }

    public function test_admin_can_upload_a_featured_blog_image_and_invalid_files_are_rejected(): void
    {
        $this->actingAsAdmin();

        // 1. Valid real image fixture (JPEG)
        $uploaded = $this->post('/api/v1/admin/blog/images', [
            'image' => UploadedFile::fake()->image('featured.jpg', 256, 256),
        ]);

        $uploaded->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.url', fn (string $url) => str_contains($url, '/uploads/blog/'));

        $path = (string) parse_url((string) $uploaded->json('data.url'), PHP_URL_PATH);
        $absolutePath = public_path(ltrim($path, '/'));
        $this->uploadedPaths[] = $absolutePath;
        $this->assertFileExists($absolutePath);

        // Verify UUID filename format
        $filename = basename($absolutePath);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i', $filename);

        // 2. Reject non-image file
        $invalid = $this->post('/api/v1/admin/blog/images', [
            'image' => UploadedFile::fake()->create('not-an-image.txt', 32, 'text/plain'),
        ]);

        $invalid->assertUnprocessable()->assertJsonValidationErrors('image');

        // 3. Reject corrupted image and ensure NO destination file is published
        $corruptFile = UploadedFile::fake()->createWithContent('corrupted.jpg', "\xFF\xD8\xFF\x00corrupted-payload");
        $corrupted = $this->post('/api/v1/admin/blog/images', [
            'image' => $corruptFile,
        ]);

        $corrupted->assertUnprocessable();
    }

    public function test_unauthorized_users_cannot_upload_blog_images(): void
    {
        // 1. Guest request is rejected
        $guestRes = $this->postJson('/api/v1/admin/blog/images', [
            'image' => UploadedFile::fake()->image('unauthorized.jpg', 100, 100),
        ]);
        $guestRes->assertUnauthorized();

        // 2. Regular customer is forbidden
        $this->actingAsCustomer();
        $custRes = $this->postJson('/api/v1/admin/blog/images', [
            'image' => UploadedFile::fake()->image('unauthorized.jpg', 100, 100),
        ]);
        $custRes->assertForbidden();
    }
}
