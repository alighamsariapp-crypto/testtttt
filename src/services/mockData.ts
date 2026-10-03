import { 
  Category, 
  Product, 
  ServiceItem, 
  ThemeSettings, 
  UserAddress, 
  CartItem, 
  UserProfile, 
  UserOrder, 
  SupportTicket, 
  ActiveSession, 
  WalletTransaction,
  BlogPost,
  StaticPagesContent,
  AppearanceSettings,
  PaymentGatewayConfig,
  SmsPanelConfig,
  DiscountCoupon,
  StoreSettings,
  CheckoutConfiguration,
  AvailablePaymentGateway,
  SmsSystemConfiguration
} from '../types';

export const initialThemeSettings: ThemeSettings = {
  font_family: 'Vazirmatn, sans-serif',
  primary_color: '#1D4ED8', // Royal Blue
  secondary_color: '#2563EB',
  accent_color: '#DC2626',
  bg_color: '#FFFFFF',
  text_color: '#0F172A',
  border_radius: '16px',
  brand_name: 'noovinnet',
};

export const initialAppearanceSettings: AppearanceSettings = {
  topBannerEnabled: true,
  topBannerText: 'جشنواره تخفیف‌های بهاره نوین‌نت: تا ۴۰٪ تخفیف روی انواع مودم 5G و سیم‌کارت‌های رند',
  topBannerBgColor: '#1E3A8A',
  topBannerTextColor: '#FFFFFF',
  topBannerLinkText: 'مشاهده جشنواره',
  topBannerLinkUrl: '/store',
  brandPrimaryColor: '#2563EB',
  brandSecondaryColor: '#1D4ED8',
  brandAccentColor: '#DC2626',
  heroSlides: [
    {
      id: 1,
      title: 'مودم‌های 5G نوین‌نت',
      subtitle: 'اینترنت فوق پرسرعت، پینگ پایین و بدون قطعی با پوشش سراسری',
      image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1000&auto=format&fit=crop&q=80',
      actionText: 'مشاهده و خرید',
      category: 'modem-internet',
      badge: 'پیشنهاد ویژه نوین‌نت',
      overlayColor: '#0F172A',
      overlayOpacity: 72
    },
    {
      id: 2,
      title: 'سیم‌کارت‌های دائمی و اعتباری رند',
      subtitle: 'بسته‌های هدیه اینترنت ۱۰۰ گیگابایت و پشتیبانی ۲۴ ساعته',
      image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1000&auto=format&fit=crop&q=80',
      actionText: 'انتخاب سیم‌کارت',
      category: 'simcard',
      badge: 'فروش ویژه سیم‌کارت',
      overlayColor: '#0F172A',
      overlayOpacity: 72
    },
    {
      id: 3,
      title: 'لپ‌تاپ‌های گیمینگ و مهندسی',
      subtitle: 'جدیدترین مدل‌های ۲۰۲۵ با گارانتی ۱۸ ماهه شرکتی و ارسال فوری',
      image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1000&auto=format&fit=crop&q=80',
      actionText: 'مشاهده لپ‌تاپ‌ها',
      category: 'laptops',
      badge: 'تخفیف ویژه مهندسی',
      overlayColor: '#0F172A',
      overlayOpacity: 72
    }
  ],
  sidePromo1Title: 'سیم‌کارت هوشمند 5G',
  sidePromo1Subtitle: 'اتصال خودکار به قوی‌ترین دکل',
  sidePromo1Image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80',
  sidePromo1Tag: 'هدیه ۱۰۰ گیگ',
  sidePromo2Title: 'روتر و تجهیزات شبکه',
  sidePromo2Subtitle: 'ویژه سازمان‌ها و برج‌های اداری',
  sidePromo2Image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
  sidePromo2Tag: 'گارانتی طلایی',
  sidePromos: [
    { id: 'side-1', title: 'سیم‌کارت هوشمند 5G', subtitle: 'اتصال خودکار به قوی‌ترین دکل', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80', tag: 'هدیه ۱۰۰ گیگ', actionText: 'مشاهده', category: 'simcard', destination: 'store', overlayColor: '#1D4ED8', overlayOpacity: 68, isVisible: true },
    { id: 'side-2', title: 'روتر و تجهیزات شبکه', subtitle: 'ویژه سازمان‌ها و برج‌های اداری', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80', tag: 'گارانتی طلایی', actionText: 'مشاهده', category: 'modem-internet', destination: 'store', overlayColor: '#0F172A', overlayOpacity: 68, isVisible: true },
  ],
  quickAccessItems: [
    { id: 'modem', title: 'مودم', icon: 'wifi', category: 'modem-internet', destination: 'store', isVisible: true },
    { id: 'simcard', title: 'سیم‌کارت', icon: 'simcard', category: 'simcard', destination: 'store', isVisible: true },
    { id: 'laptop', title: 'لپ‌تاپ', icon: 'laptop', category: 'laptops', destination: 'store', isVisible: true },
    { id: 'network', title: 'تجهیزات شبکه', icon: 'network', category: 'networking-equipment', destination: 'store', isVisible: true },
    { id: 'services', title: 'خدمات آنلاین', icon: 'services', category: '', destination: 'services', isVisible: true },
  ],
  servicesBanner: { title: 'خدمات آنلاین نوین‌نت؛ سریع و هوشمند', description: 'دسترسی آسان به خدمات دولتی و اداری از جمله ثبت‌نام کارت ملی، خدمات شناسنامه، فرم‌های گواهی و استعلامات برخط. با نوین‌نت، کارهای اداری خود را بدون نوبت و در کمترین زمان انجام دهید.', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80', primaryActionText: 'مشاهده لیست خدمات', primaryDestination: 'services', secondaryActionText: 'راهنمای ثبت‌نام', secondaryDestination: 'about', isVisible: true },
  partners: [
    { id: 'mci', name: 'همراه اول', logoText: 'MCI', subtitle: 'بزرگترین اپراتور کشور', category: '', isVisible: true },
    { id: 'irancell', name: 'ایرانسل', logoText: 'Irancell', subtitle: 'پیشرو در خدمات 5G', category: '', isVisible: true },
    { id: 'rightel', name: 'رایتل', logoText: 'RighTel', subtitle: 'پیشگام دیتای همراه', category: '', isVisible: true },
    { id: 'shatel', name: 'شاتل', logoText: 'Shatel', subtitle: 'اینترنت ثابت و فیبر نوری', category: '', isVisible: true },
    { id: 'huawei', name: 'هوآوی', logoText: 'Huawei', subtitle: 'مودم و تجهیزات شبکه', category: '', isVisible: true },
    { id: 'tplink', name: 'تی‌پی‌لینک', logoText: 'TP-Link', subtitle: 'تجهیزات وایرلس خانگی', category: '', isVisible: true },
    { id: 'mikrotik', name: 'میکروتیک', logoText: 'MikroTik', subtitle: 'تجهیزات مدیریت شبکه', category: '', isVisible: true },
    { id: 'cisco', name: 'سیسکو', logoText: 'Cisco', subtitle: 'زیرساخت سازمانی', category: '', isVisible: true },
  ]
};

export const initialStaticPagesContent: StaticPagesContent = {
  about: {
    badge: 'درباره نوین‌نت',
    title: 'پیشگام در ارائه تجهیزات شبکه و خدمات هوشمند ارتباطی',
    heroDescription: 'نوین‌نت با بیش از یک دهه تجربه در حوزه فناوری‌های ارتباطی و شبکه‌های داده، بستر جامع ارائه تجهیزات روز 5G، سیم‌کارت‌های هوشمند و درگاه‌های خدمت‌رسانی الکترونیک را برای هموطنان و سازمان‌ها در سراسر کشور فراهم آورده است.',
    missionTitle: 'ماموریت ما',
    missionText: 'تسهیل دسترسی پایدار، پرسرعت و ارزان به اینترنت مدرن و خدمات الکترونیک برای تمامی اقشار جامعه و شرکت‌ها.',
    qualityTitle: 'کیفیت و اصالت',
    qualityText: 'تمامی کالاهای ارائه شده در نوین‌نت دارای گارانتی رسمی تعویض و تاییدیه سازمان تنظیم مقررات و ارتباطات رادیویی هستند.',
    supportTitle: 'تیم مهندسی و پشتیبانی',
    supportText: 'بیش از ۵۰ کارشناس ارشد شبکه و مخابرات به صورت ۲۴ ساعته در ۷ روز هفته آماده ارائه مشاوره و حل مشکلات شما هستند.',
    statsExperience: '+۱۰ سال',
    statsCustomers: '+۱۵۰,۰۰۰',
    statsBranches: '۲۴ شعبه',
    bannerImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80'
  },
  contact: {
    title: 'تماس با نوین‌نت',
    subtitle: 'مشتاق شنیدن نظرات، سوالات و پیشنهادات شما در هر ساعت از شبانه‌روز هستیم.',
    supportPhone: '۰۲۱-۱۲۳۴۵۶۷۸',
    supportPhoneDesc: 'پاسخگویی ۲۴ ساعته در ۷ روز هفته',
    supportEmail: 'support@noovinnet.ir',
    salesEmail: 'sales@noovinnet.ir',
    centralOfficeAddress: 'تهران، خیابان ولیعصر، تقاطع میرداماد، برج فناوری ارتباطات، طبقه ۸، واحد ۸۰۴',
    workingHours: 'شنبه تا چهارشنبه: ۸:۳۰ الی ۱۸:۰۰ | پنجشنبه: ۸:۳۰ الی ۱۳:۳۰',
    instagramUrl: 'https://instagram.com/noovinnet',
    telegramUrl: 'https://t.me/noovinnet',
    whatsappUrl: '',
    socialLinks: [
      { id: 'instagram', label: 'اینستاگرام', url: 'https://instagram.com/noovinnet', icon: 'instagram', isVisible: true },
      { id: 'telegram', label: 'تلگرام', url: 'https://t.me/noovinnet', icon: 'telegram', isVisible: true },
      { id: 'whatsapp', label: 'واتس‌اپ', url: '', icon: 'whatsapp', isVisible: false },
    ],
    mapEmbedUrl: 'تهران، خیابان ولیعصر، برج فناوری ارتباطات'
  },
  footer: {
    brandDescription: 'ارائه‌دهنده پیشرو در تجهیزات شبکه، اینترنت 5G، سیم‌کارت‌های هوشمند و سامانه‌های یکپارچه خدمات آنلاین و مهندسی در سراسر کشور.',
    enamadStar: '۵ ستاره',
    samandehiStatus: 'تایید شده',
    copyrightText: 'تمامی حقوق مادی و معنوی این وب‌سایت متعلق به شرکت نوین‌نت (NoovinNet) می‌باشد.',
    showEnamad: true,
    showSamandehi: true,
    trustBadges: [
      { id: 'enamad', label: 'اینماد', caption: '۵ ستاره', imageUrl: '', url: '', isVisible: true },
      { id: 'samandehi', label: 'ساماندهی', caption: 'تایید شده', imageUrl: '', url: '', isVisible: true },
    ]
  }
};

export const initialBlogPosts: BlogPost[] = [
  {
    id: 1,
    title: 'مقایسه جامع فناوری 5G با فیبر نوری؛ کدام یک برای شما مناسب‌تر است؟',
    slug: '5g-vs-fiber-optics-ftth',
    summary: 'بررسی تفاوت سرعت، تاخیر، پایداری و هزینه‌های راه‌اندازی اینترنت نسل پنجم در مقایسه با اتصالات کابلی FTTH.',
    content: `در دنیای پرشتاب فناوری امروز، انتخاب میان اینترنت نسل پنجم موبایل (5G) و اتصالات مبتنی بر فیبر نوری (FTTH) به یکی از دغدغه‌های اصلی کاربران خانگی و سازمان‌ها تبدیل شده است.

۱. مقایسه سرعت دانلود و آپلود:
فناوری 5G قابلیت ارائه سرعت‌های تئوری تا ۱۰ گیگابیت بر ثانیه را دارد، اما در شرایط عملیاتی میانگین سرعت بین ۱۵۰ الی ۵۰۰ مگابیت نوسان دارد. در سوی دیگر، فیبر نوری سرعتی کاملاً متقارن (Symmetric) و پایدار تا ۱۰۰۰ مگابیت بر ثانیه را بدون افت سیگنال در اختیار کاربر قرار می‌دهد.

۲. پایداری و تاخیر (Latency):
برای کاربردهای حساس مانند گیمینگ آنلاین، ترید در بازارهای مالی و تماس‌های تصویری بدون وقفه، فیبر نوری با تاخیر زیر ۵ میلی‌ثانیه برنده قطعی است. در حالی که تاخیر در شبکه‌های 5G بسته به فاصله تا دکل بین ۱۵ الی ۳۰ میلی‌ثانیه خواهد بود.

نتیجه‌گیری: اگر نیاز به تحرک (Mobility) و راه‌اندازی سریع دارید، مودم‌های 5G گزینه‌ای عالی هستند. اما برای پایداری مطلق سازمانی، فیبر نوری انتخاب برتر است.`,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
    author: 'مهندس آرین رادمنش',
    category: 'شبکه و ارتباطات',
    date: '۲۸ دی ۱۴۰۳',
    readTime: '۵ دقیقه مطالعه',
    views: 1420,
    isPublished: true,
    tags: ['5G', 'فیبر نوری', 'مودم', 'اینترنت پرسرعت']
  },
  {
    id: 2,
    title: 'راهنمای گام‌به‌گام استعلام خلافی و نوبت‌دهی آنلاین پلاک خودرو',
    slug: 'online-traffic-fine-and-plate-inquiry',
    summary: 'چگونه بدون مراجعه حضوری و در کمتر از چند دقیقه وضعیت اسناد و پلاک‌های فعال خودرو را استعلام کنیم.',
    content: `با راه‌اندازی سامانه خدمات دولت الکترونیک و سرویس‌های ارزش افزوده نوین‌نت، استعلام خلافی، نمره منفی گواهینامه و پلاک‌های فعال کاملاً آنلاین و لحظه‌ای شده است.

مراحل استعلام آنلاین:
۱. وارد بخش «خدمات آنلاین» در سایت نوین‌نت شوید.
۲. کد ملی و شماره تلفن مالک خودرو را وارد کنید.
۳. بارکد ۸ رقمی پشت کارت ماشین را درج کرده و استعلام آنی را بزنید.
۴. امکان تسویه تکی یا کلی جرائم با درگاه بانکی مستقیم با صفر شدن آنی در سیستم راهور فراهم است.`,
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
    author: 'سارا کاظمی',
    category: 'خدمات آنلاین',
    date: '۲۵ دی ۱۴۰۳',
    readTime: '۳ دقیقه مطالعه',
    views: 2180,
    isPublished: true,
    tags: ['خدمات آنلاین', 'استعلام خلافی', 'راهور', 'پلاک خودرو']
  },
  {
    id: 3,
    title: 'آشنایی با پروتکل‌های اینترنت اشیاء صنعتی (IIoT) و سامانه‌های اسکادا',
    slug: 'iiot-protocols-and-scada-systems',
    summary: 'نقش شبکه‌های حسگر بی‌سیم و پروتکل‌های MQTT و Modbus در هوشمندسازی خطوط تولید کارخانجات مدرن.',
    content: `اینترنت اشیاء صنعتی (Industrial IoT) تحولی شگرف در پایش و بهینه‌سازی خطوط تولید کارخانه‌ها ایجاد کرده است.

پروتکل‌های پرکاربرد:
- MQTT: پروتکل پیام‌رسانی بسیار سبک بر پایه Publish/Subscribe مناسب برای سنسورهای با پهنای باند کم.
- Modbus TCP/IP: استاندارد سنتی و مقاوم کنترل صنعتی برای تبادل داده میان PLCها و سرورهای مرکزی.
- OPC-UA: استاندارد نسل جدید با قابلیت‌های رمزنگاری و یکپارچه‌سازی فوق‌العاده در معماری Industry 4.0.`,
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop&q=80',
    author: 'دکتر علیرضا فتاحی',
    category: 'فناوری و مهندسی',
    date: '۲۰ دی ۱۴۰۳',
    readTime: '۷ دقیقه مطالعه',
    views: 950,
    isPublished: true,
    tags: ['اینترنت اشیاء', 'IIoT', 'صنعت ۴.۰', 'شبکه']
  }
];

export const initialPaymentGateways: PaymentGatewayConfig[] = [
  {
    id: 'zarinpal',
    name: 'زرین‌پال (ZarinPal)',
    title: 'درگاه پرداخت اینترنتی زرین‌پال',
    description: 'پرداخت امن با پشتیبانی از تمامی کارت‌های عضو شتاب و سیستم تسویه خودکار روزانه',
    logo: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=100&auto=format&fit=crop&q=80',
    isEnabled: false,
    isDefault: false,
    isSandbox: true,
    merchantId: '',
    feePercentage: 1,
    dailyLimit: 200000000
  },
  {
    id: 'mellat',
    name: 'به‌پرداخت ملت (Behpardakht)',
    title: 'درگاه پرداخت مستقیم بانک ملت',
    description: 'اتصال مستقیم شاپرک بانک ملت با کمترین نرخ خطا و پایداری بالا در تراکنش‌های سنگین',
    logo: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=100&auto=format&fit=crop&q=80',
    isEnabled: false,
    isDefault: false,
    isSandbox: true,
    merchantId: '',
    terminalId: '',
    username: '',
    feePercentage: 0,
    dailyLimit: 500000000
  },
  {
    id: 'saman',
    name: 'پرداخت الکترونیک سامان (Sep)',
    title: 'درگاه پرداخت سامان کیش',
    description: 'درگاه واسط و مستقیم بانک سامان با قابلیت تسهیم وجوه و تایید دو مرحله‌ای',
    logo: 'https://images.unsplash.com/photo-1559526324-593bc073d938?w=100&auto=format&fit=crop&q=80',
    isEnabled: false,
    isDefault: false,
    isSandbox: true,
    merchantId: '',
    terminalId: '',
    feePercentage: 0.5,
    dailyLimit: 300000000
  },
  {
    id: 'idpay',
    name: 'آیدی پی (IDPay)',
    title: 'درگاه پرداخت و لینک اختصاصی آیدی‌پی',
    description: 'ارائه دهنده خدمات درگاه شخصی و سازمانی با فرم‌های دلخواه واریز وجه',
    logo: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=100&auto=format&fit=crop&q=80',
    isEnabled: false,
    isDefault: false,
    isSandbox: true,
    merchantId: 'idp_live_test_key_84920',
    feePercentage: 1,
    dailyLimit: 100000000
  },
  {
    id: 'zibal',
    name: 'زیبال (Zibal)',
    title: 'درگاه پرداخت هوشمند زیبال',
    description: 'سوییچینگ خودکار میان درگاه‌های شاپرکی برای تضمین موفقیت ۱۰۰ درصدی پرداخت‌ها',
    logo: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=100&auto=format&fit=crop&q=80',
    isEnabled: true,
    isDefault: false,
    isSandbox: false,
    merchantId: 'zbl_live_884920194820',
    feePercentage: 0.8,
    dailyLimit: 400000000
  }
];

export const initialSmsSystemConfiguration: SmsSystemConfiguration = {
  provider: 'kavenegar',
  enabled: false,
  api_key: '',
  api_key_configured: false,
  sender: '',
  otp_template: '',
  templates: {
    otp: { enabled: true, label: 'کد تأیید ورود', text: 'کد تأیید ورود شما در نوین‌نت: {code}' },
    password_reset: { enabled: true, label: 'کد بازیابی رمز عبور', text: 'کد بازیابی رمز عبور شما در نوین‌نت: {code}' },
    order_paid: { enabled: false, label: 'ثبت و پرداخت موفق سفارش', text: '{name}، سفارش {order_number} با مبلغ {amount} ریال با موفقیت ثبت و پرداخت شد.' },
    order_shipped: { enabled: false, label: 'ارسال سفارش', text: '{name}، سفارش {order_number} ارسال شد.{tracking_suffix}' },
    ticket_reply: { enabled: false, label: 'اولین پاسخ پشتیبانی', text: '{name}، پاسخ جدیدی برای تیکت {ticket_number} در نوین‌نت ثبت شد.' },
  },
};

export const initialSmsConfig: SmsPanelConfig = {
  provider: 'kavenegar',
  apiKey: '',
  senderLine: '',
  isEnabled: false,
  creditBalance: 0,
  templates: {
    otp: {
      id: 'tpl_otp',
      name: 'کد تایید ورود و ثبت‌نام (OTP)',
      patternCode: '',
      templateText: 'کد تایید شما در نوین‌نت: %token%\nمدت اعتبار: ۲ دقیقه\nنوین‌نت',
      isActive: true
    },
    orderCreated: {
      id: 'tpl_order_created',
      name: 'ثبت موفق سفارش جدید',
      patternCode: '',
      templateText: '%name% عزیز،\nسفارش شما با شماره %ordernum% با موفقیت ثبت شد و در حال آماده‌سازی است.\nپیگیری: noovinnet.ir/profile',
      isActive: true
    },
    orderShipped: {
      id: 'tpl_order_shipped',
      name: 'ارسال مرسوله و کد رهگیری پستی',
      patternCode: '',
      templateText: '%name% گرامی،\nسفارش %ordernum% تحویل پست گردید.\nکد رهگیری پیشتاز: %trackcode%\nبا سپاس از خرید شما',
      isActive: true
    },
    ticketReply: {
      id: 'tpl_ticket_reply',
      name: 'پاسخ کارشناس به تیکت پشتیبانی',
      patternCode: '',
      templateText: 'کاربر گرامی، تیکت پشتیبانی شماره %ticketid% با پاسخ کارشناس به‌روزرسانی شد.\nمشاهده: noovinnet.ir/profile',
      isActive: true
    }
  }
};

export const sampleCategories: Category[] = [
  // ==========================================
  // LEVEL 1: لپ‌تاپ و تجهیزات کامپیوتر (Laptops & Computers)
  // ==========================================
  {
    id: 100,
    name: 'لپ‌تاپ و تجهیزات',
    slug: 'laptops',
    description: 'انواع لپ‌تاپ‌های گیمینگ، اداری، مهندسی و اولترابوک‌ها با گارانتی معتبر',
    icon: 'Laptop',
    is_active: true,
    sort_order: 1,
    level: 1,
    featured_tags: ['لپ‌تاپ گیمینگ', 'مک‌بوک', 'اولترابوک اداری', 'لپ‌تاپ مهندسی'],
    children: [
      {
        id: 110,
        name: 'لپ‌تاپ و اولترابوک',
        slug: 'laptops-notebooks',
        parent_slug: 'laptops',
        level: 2,
        is_active: true,
        sort_order: 1,
        description: 'جدیدترین لپ‌تاپ‌های بازار با پردازنده‌های نسل جدید Intel، AMD و Apple Silicon',
        children: [
          { id: 111, name: 'لپ‌تاپ لنوو (Lenovo)', slug: 'lenovo', parent_slug: 'laptops-notebooks', level: 3, is_active: true, sort_order: 1, description: 'سری‌های محبوب ThinkPad، Legion و IdeaPad لنوو' },
          { id: 112, name: 'لپ‌تاپ ایسوس (ASUS)', slug: 'asus', parent_slug: 'laptops-notebooks', level: 3, is_active: true, sort_order: 2, description: 'سری‌های پرچمدار ROG، TUF Gaming و ZenBook ایسوس' },
          { id: 113, name: 'مک‌بوک اپل (Apple MacBook)', slug: 'apple', parent_slug: 'laptops-notebooks', level: 3, is_active: true, sort_order: 3, description: 'مک‌بوک پرو و ایر با تراشه‌های قدرتمند M2 و M3' },
          { id: 114, name: 'لپ‌تاپ اچ‌پی (HP)', slug: 'hp', parent_slug: 'laptops-notebooks', level: 3, is_active: true, sort_order: 4, description: 'سری‌های اداری Pavilion، Envy و Victus اچ‌پی' },
        ]
      },
      {
        id: 120,
        name: 'تبلت و کتابخوان',
        slug: 'tablets',
        parent_slug: 'laptops',
        level: 2,
        is_active: true,
        sort_order: 2,
        description: 'آیپد اپل، تبلت‌های سرفیس مایکروسافت و تبلت‌های اندرویدی سامسونگ'
      },
      {
        id: 130,
        name: 'مانیتور و نمایشگر',
        slug: 'monitors',
        parent_slug: 'laptops',
        level: 2,
        is_active: true,
        sort_order: 3,
        description: 'مانیتورهای گیمینگ 144Hz+ و مانیتورهای طراحی 4K'
      }
    ]
  },

  // ==========================================
  // LEVEL 1: سیم‌کارت و ارتباطات (SIM Cards)
  // ==========================================
  {
    id: 200,
    name: 'سیمکارت و ارتباطات',
    slug: 'simcard',
    description: 'سیم‌کارت‌های دائمی، اعتباری، دیتا و شماره‌های رند اپراتورهای برتر کشور',
    icon: 'SimCard',
    is_active: true,
    sort_order: 2,
    level: 1,
    featured_tags: ['سیم‌کارت ۰۹۱۲ دائمی', 'ایرانسل رند', 'بسته ۱۰۰ گیگ هدیه', 'سیم‌کارت دیتا'],
    children: [
      {
        id: 210,
        name: 'سیم‌کارت ایرانسل (Irancell)',
        slug: 'irancell',
        parent_slug: 'simcard',
        level: 2,
        is_active: true,
        sort_order: 1,
        description: 'سیم‌کارت‌های دائمی، اعتباری و رند ۰۹۳۵، ۰۹۳۶ و ۰۹۰۲ ایرانسل با اینترنت رایگان',
        children: [
          { id: 211, name: 'دائمی ایرانسل (Postpaid)', slug: 'irancell-permanent', parent_slug: 'irancell', level: 3, is_active: true, sort_order: 1 },
          { id: 212, name: 'اعتباری ایرانسل (Prepaid)', slug: 'irancell-credit', parent_slug: 'irancell', level: 3, is_active: true, sort_order: 2 },
          { id: 213, name: 'شماره‌های رند ایرانسل', slug: 'irancell-rond', parent_slug: 'irancell', level: 3, is_active: true, sort_order: 3 },
        ]
      },
      {
        id: 220,
        name: 'سیم‌کارت همراه اول (MCI)',
        slug: 'mci',
        parent_slug: 'simcard',
        level: 2,
        is_active: true,
        sort_order: 2,
        description: 'خطوط دائمی ۰۹۱۲، خطوط اعتباری ۰۹۹۰ و ۰۹۱۹ همراه اول با پوشش سراسری',
        children: [
          { id: 221, name: 'دائمی ۰۹۱۲ همراه اول', slug: 'mci-permanent-0912', parent_slug: 'mci', level: 3, is_active: true, sort_order: 1 },
          { id: 222, name: 'اعتباری همراه اول', slug: 'mci-credit', parent_slug: 'mci', level: 3, is_active: true, sort_order: 2 },
        ]
      },
      {
        id: 230,
        name: 'سیم‌کارت رایتل (RighTel)',
        slug: 'rightel',
        parent_slug: 'simcard',
        level: 2,
        is_active: true,
        sort_order: 3,
        description: 'سیم‌کارت‌های دیتای پرسرعت رایتل و بسته‌های بلندمدت بهصرفه'
      },
      {
        id: 240,
        name: 'شاتل موبایل (Shatel Mobile)',
        slug: 'shatel-mobile',
        parent_slug: 'simcard',
        level: 2,
        is_active: true,
        sort_order: 4,
        description: 'سیم‌کارت هوشمند با قابلیت اتصال خودکار به بهترین دکل منطقه'
      }
    ]
  },

  // ==========================================
  // LEVEL 1: مودم و اینترنت (Modems & Internet)
  // ==========================================
  {
    id: 300,
    name: 'مودم و اینترنت',
    slug: 'modem-internet',
    description: 'انواع مودم‌های فوق سریع 5G، 4G LTE، رومیزی، فیبر نوری FTTH و همراه',
    icon: 'Wifi',
    is_active: true,
    sort_order: 3,
    level: 1,
    featured_tags: ['مودم 5G هوآوی', 'مودم جیبی همراه', 'مودم فیبر نوری', 'مودم سیم‌کارتی'],
    children: [
      { id: 310, name: 'مودم 5G فوق سریع', slug: 'modem-5g', parent_slug: 'modem-internet', level: 2, is_active: true, sort_order: 1, description: 'مودم‌های نسل پنجم با سرعت گیگابیتی و پشتیبانی از تمام اپراتورها' },
      { id: 320, name: 'مودم 4G / LTE', slug: 'modem-4g', parent_slug: 'modem-internet', level: 2, is_active: true, sort_order: 2, description: 'مودم‌های نسل چهارم Cat6 و Cat19 با پایداری بالا' },
      { id: 330, name: 'مودم سیم‌کارتی', slug: 'modem-simcard', parent_slug: 'modem-internet', level: 2, is_active: true, sort_order: 3, description: 'مودم‌های آنلاک بدون محدودیت اپراتور' },
      { id: 340, name: 'مودم رومیزی و ADSL/VDSL', slug: 'modem-desktop', parent_slug: 'modem-internet', level: 2, is_active: true, sort_order: 4, description: 'مودم‌های مخصوص مصارف اداری، منازل و خطوط ثابت' },
      { id: 350, name: 'مودم همراه و جیبی', slug: 'modem-pocket', parent_slug: 'modem-internet', level: 2, is_active: true, sort_order: 5, description: 'مودم‌های باتری‌دار پرتابل مخصوص سفر و کاربری سیار' },
      { id: 360, name: 'روتر و اکسس پوینت', slug: 'routers', parent_slug: 'modem-internet', level: 2, is_active: true, sort_order: 6, description: 'روترهای گیمینگ Wi-Fi 6 و سیستم‌های مش وای‌فای' },
    ]
  },

  // ==========================================
  // LEVEL 1: تجهیزات شبکه (Networking Equipment)
  // ==========================================
  {
    id: 400,
    name: 'تجهیزات شبکه',
    slug: 'networking-equipment',
    description: 'سوئیچ‌های مدیریتی و غیرمدیریتی، روتربورد، رک و کابل‌های استاندارد شبکه',
    icon: 'Server',
    is_active: true,
    sort_order: 4,
    level: 1,
    featured_tags: ['سوئیچ سیسکو', 'کابل Cat6 تمام مس', 'سوئیچ PoE', 'میکروتیک'],
    children: [
      { id: 410, name: 'سوئیچ شبکه (Switches)', slug: 'switches', parent_slug: 'networking-equipment', level: 2, is_active: true, sort_order: 1 },
      { id: 420, name: 'کابل و پچ‌کورد شبکه', slug: 'cables', parent_slug: 'networking-equipment', level: 2, is_active: true, sort_order: 2 },
      { id: 430, name: 'تجهیزات پسیو و رک', slug: 'passive-racks', parent_slug: 'networking-equipment', level: 2, is_active: true, sort_order: 3 },
    ]
  },

  // ==========================================
  // LEVEL 1: لوازم جانبی (Accessories)
  // ==========================================
  {
    id: 500,
    name: 'لوازم جانبی',
    slug: 'accessories',
    description: 'آداپتور، آنتن‌های تقویت سیگنال، هدفون و مبدل‌های ارتباطی',
    icon: 'Headphones',
    is_active: true,
    sort_order: 5,
    level: 1,
    children: [
      { id: 510, name: 'آداپتور و کابل تغذیه', slug: 'chargers', parent_slug: 'accessories', level: 2, is_active: true, sort_order: 1 },
      { id: 520, name: 'آنتن تقویت سیگنال 4G/5G', slug: 'antennas', parent_slug: 'accessories', level: 2, is_active: true, sort_order: 2 },
      { id: 530, name: 'هدفون و صوتی', slug: 'audio', parent_slug: 'accessories', level: 2, is_active: true, sort_order: 3 },
    ]
  }
];

export const sampleProducts: Product[] = [
  // =========================================================================
  // LAPTOPS & COMPUTERS (Lenovo, ASUS, Apple, HP)
  // ==========================================
  {
    id: 101,
    category_id: 100,
    category_name: 'لپ‌تاپ و تجهیزات',
    category_slug: 'laptops',
    subcategory_slug: 'laptops-notebooks',
    sub_subcategory_slug: 'lenovo',
    category_path: ['laptops', 'laptops-notebooks', 'lenovo'],
    brand: 'Lenovo',
    brand_slug: 'lenovo',
    name: 'لپ‌تاپ ۱۵.۶ اینچی لنوو مدل Legion Pro 5 - i7 16GB 1TB RTX4060',
    slug: 'lenovo-legion-pro-5-i7-rtx4060',
    sku: 'LNV-LGN-P5-4060',
    description: 'لپ‌تاپ گیمینگ و مهندسی پرچمدار لنوو مجهز به پردازنده نسل ۱۴ اینتل Core i7-14700HX، کارت گرافیک ۸ گیگابایتی RTX 4060، حافظه رم ۱۶ گیگابایت DDR5 با قابلیت ارتقا و حافظه فوق سریع ۱ ترابایت SSD NVMe Gen4 به همراه نمایشگر ۱۶۵ هرتزی WQXGA.',
    base_price: 88500000,
    effective_price: 84900000,
    discount_percentage: 4,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=700&auto=format&fit=crop&q=80',
    gallery_urls: [
      'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
    ],
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    rating: 4.9,
    review_count: 68,
    in_stock: true,
    stock_quantity: 8,
    processor: 'Intel Core i7 14700HX',
    ram_capacity: '16GB DDR5',
    storage_capacity: '1TB SSD NVMe',
    gpu: 'NVIDIA GeForce RTX 4060 (8GB)',
    screen_size: '16 اینچ',
    screen_resolution: '2K QHD (2560x1600) 165Hz',
    os: 'Windows 11 Home',
    colors: [
      { name: 'خاکستری تیره (Onyx Grey)', hex: '#334155' }
    ],
    specs: {
      'سازنده پردازنده': 'Intel Core i7-14700HX (20 هسته / 28 رشته)',
      'حافظه رم (RAM)': '16 گیگابایت DDR5 5600MHz (قابل ارتقا تا 64GB)',
      'حافظه داخلی': '1 ترابایت SSD M.2 NVMe PCIe 4.0',
      'پردازنده گرافیکی': 'NVIDIA GeForce RTX 4060 8GB GDDR6 (140W TGP)',
      'اندازه صفحه نمایش': '16 اینچ IPS مات با رزولوشن WQXGA 165Hz 100% sRGB',
      'سیستم خنک‌کننده': 'Legion ColdFront 5.0 با اتاقک بخار و فن‌های دوگانه',
      'سیستم‌عامل': 'Windows 11 اورجینال ۶۴ بیتی',
    },
    comments: [
      {
        id: 1001,
        author: 'علیرضا حسینی',
        rating: 5,
        date: '۲ روز پیش',
        title: 'قدرت پردازشی فوق‌العاده برای رندر و گیمینگ',
        content: 'کیفیت ساخت بدنه لنوو لژیون پرو ۵ بی‌نظیره. کیبورد نرم با نور پس‌زمینه عالی و سیستم خنک‌کننده حتی زیر لود سنگین ۳ بعدی بی‌صدا کار می‌کنه.',
        is_buyer: true,
        likes: 19,
        dislikes: 0,
        pros: ['سیستم خنک‌کنندگی عالی', 'نمایشگر 2K با روشنایی ۵۰۰ نیت', 'پورت‌های کامل در پشت دستگاه']
      }
    ]
  },
  {
    id: 102,
    category_id: 100,
    category_name: 'لپ‌تاپ و تجهیزات',
    category_slug: 'laptops',
    subcategory_slug: 'laptops-notebooks',
    sub_subcategory_slug: 'lenovo',
    category_path: ['laptops', 'laptops-notebooks', 'lenovo'],
    brand: 'Lenovo',
    brand_slug: 'lenovo',
    name: 'لپ‌تاپ لنوو مدل ThinkPad E16 - Core i5 16GB 512GB SSD',
    slug: 'lenovo-thinkpad-e16-core-i5',
    sku: 'LNV-TP-E16-I5',
    description: 'لپ‌تاپ حرفه‌ای اداری و بیزنس لنوو با دوام فوق‌العاده با استاندارد نظامی MIL-STD-810H، پردازنده نسل ۱۳ اینتل، حسگر اثر انگشت روی دکمه پاور و باتری پرظرفیت ۵۷ وات‌ساعتی.',
    base_price: 43200000,
    effective_price: 41800000,
    discount_percentage: 3,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=700&auto=format&fit=crop&q=80',
    gallery_urls: [
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
    ],
    is_active: true,
    is_featured: false,
    rating: 4.7,
    review_count: 32,
    in_stock: true,
    stock_quantity: 14,
    processor: 'Intel Core i5 1335U',
    ram_capacity: '16GB DDR4',
    storage_capacity: '512GB SSD NVMe',
    gpu: 'Intel Iris Xe Graphics',
    screen_size: '16 اینچ',
    screen_resolution: 'Full HD (1920x1200) WUXGA',
    os: 'Windows 11 Pro',
    colors: [
      { name: 'مشکی کلاسیک تینک‌پد', hex: '#1E293B' }
    ],
    specs: {
      'پردازنده': 'Intel Core i5-1335U (10 هسته / 12 رشته)',
      'حافظه رم': '16 گیگابایت DDR4 3200MHz',
      'حافظه داخلی': '512GB SSD M.2 PCIe NVMe',
      'گرافیک': 'Intel Iris Xe Graphics',
      'صفحه نمایش': '16 اینچ WUXGA IPS مات با زاویه دید ۱۷۸ درجه',
      'استاندارد مقاومت': 'استاندارد نظامی ارتش آمریکا MIL-STD-810H',
    }
  },
  {
    id: 103,
    category_id: 100,
    category_name: 'لپ‌تاپ و تجهیزات',
    category_slug: 'laptops',
    subcategory_slug: 'laptops-notebooks',
    sub_subcategory_slug: 'asus',
    category_path: ['laptops', 'laptops-notebooks', 'asus'],
    brand: 'ASUS',
    brand_slug: 'asus',
    name: 'لپ‌تاپ ۱۴ اینچی ایسوس مدل ZenBook 14 OLED - Ultra 7 32GB 1TB',
    slug: 'asus-zenbook-14-oled-ultra7',
    sku: 'ASUS-ZB14-U7',
    description: 'اولترابوک فوق سبک و باریک ۱.۲ کیلوگرمی با نمایشگر خیره‌کننده OLED 3K 120Hz، پردازنده هوش مصنوعی اینتل Core Ultra 7 155H و باتری شگفت‌انگیز ۷۵ وات‌ساعتی با ۱۵ ساعت شارژدهی.',
    base_price: 79000000,
    effective_price: 79000000,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=700&auto=format&fit=crop&q=80',
    gallery_urls: [
      'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&auto=format&fit=crop&q=80',
    ],
    is_active: true,
    is_featured: true,
    rating: 4.9,
    review_count: 45,
    in_stock: true,
    stock_quantity: 6,
    processor: 'Intel Core Ultra 7 155H',
    ram_capacity: '32GB LPDDR5X',
    storage_capacity: '1TB SSD NVMe',
    gpu: 'Intel Arc Graphics',
    screen_size: '14 اینچ',
    screen_resolution: '3K OLED (2880x1800) 120Hz',
    os: 'Windows 11 Home',
    colors: [
      { name: 'آبی اقیانوسی (Ponder Blue)', hex: '#1E3A8A' },
      { name: 'نقره‌ای مهتابی', hex: '#CBD5E1' }
    ],
    specs: {
      'پردازنده': 'Intel Core Ultra 7 155H با واحد پردازش عصبی NPU اختصاصی',
      'نمایشگر': '14 اینچ Lumina OLED 3K با پشتیبانی از 100% DCI-P3 و HDR True Black 600',
      'وزن': 'فقط ۱.۲ کیلوگرم با ضخامت ۱۴.۹ میلی‌متر',
      'صدا': 'سیستم صوتی Harman Kardon با Dolby Atmos',
    }
  },
  {
    id: 104,
    category_id: 100,
    category_name: 'لپ‌تاپ و تجهیزات',
    category_slug: 'laptops',
    subcategory_slug: 'laptops-notebooks',
    sub_subcategory_slug: 'apple',
    category_path: ['laptops', 'laptops-notebooks', 'apple'],
    brand: 'Apple',
    brand_slug: 'apple',
    name: 'مک‌بوک ایر ۱۳.۶ اینچی اپل با تراشه M3 - رم 16GB و حافظه 512GB SSD',
    slug: 'apple-macbook-air-13-m3-16gb-512gb',
    sku: 'APL-MBA13-M3',
    description: 'مک‌بوک ایر باریک و قدرتمند با تراشه ۳ نانومتری Apple M3، پشتیبانی همزمان از دو مانیتور خارجی، بدنه تمام آلومینیومی مستحکم و شارژدهی تا ۱۸ ساعت مداوم.',
    base_price: 94000000,
    effective_price: 91500000,
    discount_percentage: 3,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=700&auto=format&fit=crop&q=80',
    gallery_urls: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
    ],
    is_active: true,
    is_featured: true,
    rating: 5.0,
    review_count: 82,
    in_stock: true,
    stock_quantity: 11,
    processor: 'Apple M3 (8-Core CPU)',
    ram_capacity: '16GB Unified',
    storage_capacity: '512GB SSD',
    gpu: 'Apple 10-Core GPU',
    screen_size: '13.6 اینچ',
    screen_resolution: 'Liquid Retina (2560x1664)',
    os: 'macOS Sonoma',
    colors: [
      { name: 'Midnight (مشکی نیمه‌شب)', hex: '#0F172A' },
      { name: 'Starlight (طلایی مهتابی)', hex: '#FEF3C7' },
      { name: 'Space Grey (خاکستری فضایی)', hex: '#475569' },
      { name: 'Silver (نقره‌ای)', hex: '#E2E8F0' }
    ],
    specs: {
      'تراشه پردازنده': 'Apple M3 chip با معماری ۳ نانومتری نسل جدید',
      'حافظه یکپارچه': '16 گیگابایت Unified Memory با پهنای باند 100GB/s',
      'حافظه ذخیره‌سازی': '512 گیگابایت SSD فوق سریع',
      'صفحه نمایش': '13.6 اینچ Liquid Retina با روشنایی ۵۰۰ نیت و True Tone',
      'عمر باتری': 'تا ۱۸ ساعت وبگردی و پخش ویدیو',
    }
  },

  // =========================================================================
  // SIM CARDS (Irancell, MCI, RighTel, Shatel)
  // ==========================================
  {
    id: 201,
    category_id: 200,
    category_name: 'سیمکارت و ارتباطات',
    category_slug: 'simcard',
    subcategory_slug: 'irancell',
    sub_subcategory_slug: 'irancell-permanent',
    category_path: ['simcard', 'irancell', 'irancell-permanent'],
    brand: 'Irancell',
    brand_slug: 'irancell',
    name: 'سیم‌کارت دائمی ایرانسل پیش‌شماره ۰۹۳۵ به همراه بسته ۱۰۰ گیگابایت هدیه',
    slug: 'irancell-permanent-0935-100gb-gift',
    sku: 'SIM-IRN-0935-PERM',
    description: 'سیم‌کارت دائمی شش دانگ ایرانسل با پیش‌شماره معتبر ۰۹۳۵، بدون نیاز به شارژ ماهیانه، به همراه بسته خوش‌آمدگویی شامل ۱۰۰ گیگابایت اینترنت ۶ ماهه، ۹۰۰ دقیقه مکالمه درون شبکه و ۹۰۰ پیامک رایگان با ثبت‌نام و احراز هویت آنی.',
    base_price: 320000,
    effective_price: 280000,
    discount_percentage: 12,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?w=700&auto=format&fit=crop&q=80',
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    rating: 4.8,
    review_count: 145,
    in_stock: true,
    stock_quantity: 90,
    sim_operator: 'irancell',
    sim_type: 'permanent',
    sim_status: 'normal',
    sim_prefix: '0935',
    sim_gift_internet: 'بسته ۱۰۰ گیگ ۶ ماهه',
    specs: {
      'اپراتور': 'ایرانسل (MTN Irancell)',
      'نوع خط': 'دائمی (Postpaid) با سقف مصرف مجاز قابل تنظیم',
      'پیش‌شماره': '۰۹۳۵ (تهران و سراسر کشور)',
      'بسته هدیه خوش‌آمد': '۱۰۰ گیگ اینترنت + ۹۰۰ دقیقه مکالمه + ۹۰۰ پیامک',
      'احراز هویت': 'آنلاین از طریق کارت ملی و کد ثنا در کمتر از ۱۰ دقیقه',
    }
  },
  {
    id: 202,
    category_id: 200,
    category_name: 'سیمکارت و ارتباطات',
    category_slug: 'simcard',
    subcategory_slug: 'irancell',
    sub_subcategory_slug: 'irancell-rond',
    category_path: ['simcard', 'irancell', 'irancell-rond'],
    brand: 'Irancell',
    brand_slug: 'irancell',
    name: 'سیم‌کارت طلایی رند ایرانسل ۰۹۰۲ (رند پله‌ای و آیینه‌ای)',
    slug: 'irancell-gold-rond-0902',
    sku: 'SIM-IRN-ROND-0902',
    description: 'خط فوق‌العاده رند ایرانسل مناسب برندها، وکلا، پزشکان و کسب‌وکارهای معتبر، سیم‌کارت خام و صفر بدون هیچ‌گونه سابقه تماس قبلی با انتقال سند قطعی.',
    base_price: 2400000,
    effective_price: 2400000,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?w=700&auto=format&fit=crop&q=80',
    is_active: true,
    is_featured: true,
    rating: 4.9,
    review_count: 38,
    in_stock: true,
    stock_quantity: 5,
    sim_operator: 'irancell',
    sim_type: 'permanent',
    sim_status: 'rond',
    sim_prefix: '0902',
    sim_gift_internet: 'بسته ۵۰ گیگابایت',
    specs: {
      'اپراتور': 'ایرانسل',
      'وضعیت شماره': 'رند درجه یک (آیینه‌ای و پله‌ای تکرار زوج)',
      'وضعیت سیم‌کارت': 'کاملاً صفر (خام و فعال‌نشده)',
      'نوع خط': 'دائمی',
    }
  },
  {
    id: 203,
    category_id: 200,
    category_name: 'سیمکارت و ارتباطات',
    category_slug: 'simcard',
    subcategory_slug: 'mci',
    sub_subcategory_slug: 'mci-permanent-0912',
    category_path: ['simcard', 'mci', 'mci-permanent-0912'],
    brand: 'MCI',
    brand_slug: 'mci',
    name: 'سیم‌کارت دائمی همراه اول کد ۱ تهران (۰۹۱۲ - ۱)',
    slug: 'mci-permanent-0912-code-1',
    sku: 'SIM-MCI-0912-C1',
    description: 'سیم‌کارت دائمی همراه اول کد ۱ اصیل تهران با وضعیت کارکرد عالی، تضمین اصالت خط و انتقال سند رسمی در دفاتر پیشخوان دولت سراسر تهران و کشور.',
    base_price: 45000000,
    effective_price: 45000000,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?w=700&auto=format&fit=crop&q=80',
    is_active: true,
    is_featured: true,
    rating: 5.0,
    review_count: 52,
    in_stock: true,
    stock_quantity: 3,
    sim_operator: 'mci',
    sim_type: 'permanent',
    sim_status: 'rond',
    sim_prefix: '0912',
    specs: {
      'اپراتور': 'همراه اول (ارتباطات سیار ایران)',
      'پیش‌شماره': '۰۹۱۲ کد ۱ تهران',
      'نوع خط': 'دائمی شرکتی و شخصی معتبر',
      'انتقال مالکیت': 'رسمی و حضوری در دفتر پیشخوان یا غیرحضوری سامانه شاهکار',
    }
  },
  {
    id: 204,
    category_id: 200,
    category_name: 'سیمکارت و ارتباطات',
    category_slug: 'simcard',
    subcategory_slug: 'mci',
    sub_subcategory_slug: 'mci-credit',
    category_path: ['simcard', 'mci', 'mci-credit'],
    brand: 'MCI',
    brand_slug: 'mci',
    name: 'سیم‌کارت اعتباری همراه اول ۰۹۹۰ با بسته ۲۴ گیگ اینترنت رایگان',
    slug: 'mci-credit-0990-starter-pack',
    sku: 'SIM-MCI-0990',
    description: 'سیم‌کارت اعتباری نسل چهار و نیم همراه اول با پوشش سراسری آنتن‌دهی در تمام جاده‌ها و شهرهای کشور، مناسب استفاده روزمره یا درگاه‌های پیامکی و مودم‌ها.',
    base_price: 95000,
    effective_price: 80000,
    discount_percentage: 15,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?w=700&auto=format&fit=crop&q=80',
    is_active: true,
    is_featured: false,
    rating: 4.6,
    review_count: 91,
    in_stock: true,
    stock_quantity: 200,
    sim_operator: 'mci',
    sim_type: 'credit',
    sim_status: 'zero',
    sim_prefix: '0990',
    sim_gift_internet: 'بسته ۲۴ گیگابایت',
  },

  // =========================================================================
  // MODEMS & INTERNET (Huawei, TP-Link, Mobinnet, ZTE, D-Link)
  // ==========================================
  {
    id: 1,
    category_id: 300,
    category_name: 'مودم و اینترنت',
    category_slug: 'modem-internet',
    subcategory_slug: 'modem-5g',
    category_path: ['modem-internet', 'modem-5g'],
    brand: 'Huawei',
    brand_slug: 'huawei',
    technology: '5G',
    network_generation: '5G',
    modem_type: 'desktop',
    ethernet_ports: '۲ پورت گیگابیت',
    wifi_standard: 'Wi-Fi 6 (802.11ax)',
    device_compatibility: ['mobile', 'desktop', 'tablet'],
    colors: [
      { name: 'سفید', hex: '#FFFFFF' },
      { name: 'مشکی', hex: '#1E293B' },
      { name: 'نقره‌ای', hex: '#CBD5E1' }
    ],
    name: 'مودم روتر 5G هوآوی مدل H112-372',
    slug: 'huawei-5g-cpe-pro-h112-372',
    sku: 'HW-5G-H112',
    description: 'مودم روتر فوق سریع نسل پنجم با چیپست Balong 5000، پشتیبانی از Wi-Fi 6 دو بانده با پهنای باند تا ۲.۳۳ گیگابیت بر ثانیه، دارای ۲ پورت گیگابیت اترنت و آنتن‌های داخلی چند جهته تقویت سیگنال.',
    base_price: 8500000,
    effective_price: 8500000,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
    gallery_urls: [
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=800&auto=format&fit=crop&q=80',
    ],
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    rating: 4.8,
    review_count: 120,
    in_stock: true,
    stock_quantity: 18,
    variants: [
      { id: 101, product_id: 1, name: 'سفید استاندارد (گارانتی ۱۸ ماهه نوین‌نت)', sku: 'HW-H112-WHT', effective_price: 8500000, is_active: true, stock_quantity: 12 },
      { id: 102, product_id: 1, name: 'سفید به همراه سیم‌کارت بسته ۱۰۰ گیگ', sku: 'HW-H112-SIM', effective_price: 8950000, is_active: true, stock_quantity: 6 },
    ],
    specs: {
      'تکنولوژی ارتباطی': '5G Sub-6 / 4G LTE Cat 19',
      'چیپست پردازنده': 'Huawei Balong 5000',
      'حداکثر سرعت دانلود': 'تا ۲.۳۳ گیگابیت بر ثانیه',
      'تعداد پورت شبکه': '۲ عدد پورت Gigabit LAN/WAN',
      'پشتیبانی همزمان کاربر': 'حداکثر ۶۴ کاربر فعال',
      'نوع سیم‌کارت': 'نانو سیم (پشتیبانی از تمام اپراتورها)',
    }
  },
  {
    id: 2,
    category_id: 300,
    category_name: 'مودم و اینترنت',
    category_slug: 'modem-internet',
    subcategory_slug: 'modem-pocket',
    category_path: ['modem-internet', 'modem-pocket'],
    brand: 'TP-Link',
    brand_slug: 'tp-link',
    technology: '4G',
    network_generation: '4G LTE',
    modem_type: 'pocket',
    device_compatibility: ['mobile', 'tablet'],
    colors: [
      { name: 'مشکی', hex: '#1E293B' },
      { name: 'نقره‌ای', hex: '#CBD5E1' }
    ],
    name: 'مودم 4G قابل حمل تی پی-لینک مدل M7200',
    slug: 'tp-link-m7200-portable-4g-modem',
    sku: 'TPL-M7200',
    description: 'مودم همراه جیبی پرتابل با باتری ۲۰۰۰ میلی‌آمپر ساعتی با شارژدهی ۸ ساعت پیوسته، سرعت دانلود ۱۵۰ مگابیت بر ثانیه و اشتراک‌گذاری همزمان اینترنت بین ۱۰ دستگاه.',
    base_price: 2100000,
    effective_price: 1950000,
    discount_percentage: 7,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
    gallery_urls: [
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
    ],
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    rating: 4.2,
    review_count: 85,
    in_stock: true,
    stock_quantity: 25,
    specs: {
      'نوع اتصال': 'بی‌سیم (Wi-Fi 2.4GHz)',
      'ظرفیت باتری': '۲۰۰۰ میلی‌آمپر ساعت (۸ ساعت کارکرد)',
      'سرعت دانلود / آپلود': '150Mbps / 50Mbps',
      'تعداد کاربران همزمان': '۱۰ کاربر',
    }
  },
  {
    id: 5,
    category_id: 300,
    category_name: 'مودم و اینترنت',
    category_slug: 'modem-internet',
    subcategory_slug: 'modem-desktop',
    category_path: ['modem-internet', 'modem-desktop'],
    brand: 'Mobinnet',
    brand_slug: 'mobinnet',
    technology: '5G / TD-LTE',
    network_generation: 'TD-LTE',
    modem_type: 'desktop',
    ethernet_ports: '۴ پورت گیگابیت',
    device_compatibility: ['desktop', 'mobile', 'tablet'],
    colors: [
      { name: 'سفید', hex: '#FFFFFF' }
    ],
    name: 'مودم رومیزی 5G مبین‌نت مدل M53',
    slug: 'mobinnet-5g-desktop-modem-m53',
    sku: 'MBN-5G-M53',
    description: 'مودم رومیزی اختصاصی با پشتیبانی از شبکه TD-LTE و 5G، مناسب منازل، برج‌ها و مجتمع‌های اداری با سرعت دانلود پایدار تا ۲۰۰ مگابیت.',
    base_price: 5400000,
    effective_price: 5400000,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
    is_active: true,
    is_featured: true,
    rating: 4.6,
    review_count: 51,
    in_stock: true,
    stock_quantity: 15,
  },

  // =========================================================================
  // NETWORKING EQUIPMENT (Cisco, Mikrotik, TP-Link, Nexans)
  // ==========================================
  {
    id: 6,
    category_id: 400,
    category_name: 'تجهیزات شبکه',
    category_slug: 'networking-equipment',
    subcategory_slug: 'switches',
    category_path: ['networking-equipment', 'switches'],
    brand: 'Cisco',
    brand_slug: 'cisco',
    technology: 'Gigabit Ethernet',
    switch_type: 'unmanaged',
    port_count: '8 پورت',
    poe_supported: false,
    device_compatibility: ['desktop'],
    colors: [
      { name: 'مشکی', hex: '#1E293B' },
      { name: 'نقره‌ای', hex: '#CBD5E1' }
    ],
    name: 'سوئیچ ۸ پورت سیسکو Business 110',
    slug: 'cisco-business-110-8-port-switch',
    sku: 'CS-CBS110-8T',
    description: 'سوئیچ مدیریتی غیرماژولار گیگابیتی سری CBS110 با بدنه فلزی مستحکم، طراحی بی‌صدا بدون فن (Fanless)، مصرف بهینه برق و کارکرد ۲۴ ساعته صنعتی بدون افت کیفیت.',
    base_price: 2100000,
    effective_price: 2100000,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
    is_active: true,
    is_featured: true,
    rating: 4.8,
    review_count: 29,
    in_stock: true,
    stock_quantity: 30,
    specs: {
      'تعداد پورت': '۸ عدد پورت Gigabit RJ-45',
      'ظرفیت سوئیچینگ': '16 Gbps',
      'طراحی بدنه': 'فلزی مقاوم بدون فن (کاملاً بی‌صدا)',
    }
  },
  {
    id: 9,
    category_id: 400,
    category_name: 'تجهیزات شبکه',
    category_slug: 'networking-equipment',
    subcategory_slug: 'cables',
    category_path: ['networking-equipment', 'cables'],
    brand: 'Nexans',
    brand_slug: 'nexans',
    name: 'کابل شبکه Cat6 SFTP نگزنس تمام مس - کلاف ۳۰۵ متری',
    slug: 'nexans-cat6-sftp-copper-cable-305m',
    sku: 'NXN-CBL-CAT6-305',
    description: 'کابل شبکه با روکش ضد حریق LSZH، هادی ۱۰۰٪ مس خالص با فویل و شیلد آلومینیومی محافظ در برابر نویزهای سنگین صنعتی و استاندارد تست فلوک چنل و پرمننت.',
    base_price: 4900000,
    effective_price: 4900000,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
    is_active: true,
    is_featured: false,
    rating: 4.7,
    review_count: 18,
    in_stock: true,
    stock_quantity: 40,
  },

  // =========================================================================
  // ACCESSORIES
  // ==========================================
  {
    id: 7,
    category_id: 500,
    category_name: 'لوازم جانبی',
    category_slug: 'accessories',
    subcategory_slug: 'audio',
    category_path: ['accessories', 'audio'],
    brand: 'Sony',
    brand_slug: 'sony',
    name: 'هدفون بی‌سیم سونی مدل WH-1000XM5',
    slug: 'sony-wh-1000xm5-wireless-headphones',
    sku: 'SNY-WH-1000XM5',
    description: 'پرچمدار هدفون‌های نویزکنسلینگ سونی با پردازنده اختصاصی V1 و QN1، کیفیت صدای Hi-Res، هشت میکروفون هوشمند حذف صدای محیط و شارژدهی تا ۳۰ ساعت مداوم.',
    base_price: 14500000,
    effective_price: 14500000,
    currency: 'تومان',
    image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80',
    is_active: true,
    is_featured: true,
    rating: 4.9,
    review_count: 94,
    in_stock: true,
    stock_quantity: 10,
  }
];

export const sampleServices: ServiceItem[] = [
  {
    id: 1,
    name: 'استعلام جامع خودرو و خلافی',
    slug: 'car-inquiry-services',
    category: 'خدمات خودرو',
    short_description: 'بررسی آنلاین وضعیت، خلافی و سوابق خودرو در کمترین زمان',
    description: 'سرویس یکپارچه بررسی سوابق بیمه، جریمه‌ها، عوارض سالیانه شهرداری و پلاک فعال.',
    estimated_base_price: 50000,
    currency: 'تومان',
    icon: 'Search',
    is_active: true,
    documents: [
      'شماره پلاک خودرو به‌صورت کامل و خوانا',
      'کد ملی مالک خودرو برای تطبیق اطلاعات',
      'شماره تماس در دسترس برای دریافت نتیجه و پیگیری',
    ],
    steps: [
      'اطلاعات و مدارک بالا را پیش از ارتباط آماده کنید.',
      'از راه ارتباطی مشخص‌شده درخواست خود را ثبت کنید.',
      'کارشناس نتیجهٔ استعلام و راهنمای اقدام بعدی را اعلام می‌کند.',
    ],
    faq: [
      { question: 'برای این استعلام چه اطلاعاتی لازم است؟', answer: 'شماره پلاک خودرو و کد ملی مالک؛ ممکن است در موارد خاص، اطلاعات تکمیلی نیز از شما خواسته شود.' },
      { question: 'نتیجهٔ استعلام چه زمانی اعلام می‌شود؟', answer: 'زمان پاسخ بر اساس نوع استعلام و کامل‌بودن اطلاعات تعیین می‌شود و کارشناس هنگام ثبت درخواست آن را اعلام می‌کند.' },
      { question: 'آیا این صفحه پرداخت یا API دارد؟', answer: 'خیر. این خدمت راهنمای انجام و مسیر ارتباط مستقیم با پشتیبانی است و به درگاه یا API بیرونی متصل نیست.' },
    ],
    contact_type: 'external',
    contact_url: 'https://noovinnet.ir/contact',
    cta_label: 'ارتباط با پشتیبانی نوین‌نت',
    required_fields: [
      { name: 'plate_number', label: 'شماره پلاک خودرو', type: 'text', required: true },
      { name: 'national_code', label: 'کد ملی مالک', type: 'text', required: true },
    ],
  },
  {
    id: 2,
    name: 'راه‌اندازی شبکه سازمانی و کانفیگ میکروتیک',
    slug: 'enterprise-network-setup',
    category: 'شبکه و زیرساخت',
    short_description: 'طراحی، کابل‌کشی ساخت‌یافته و کانفیگ روترها و فایروال‌های امنیتی',
    description: 'پیاده‌سازی شبکه‌های سیمی و بی‌سیم امن با تضمین پهنای باند و تفکیک دسترسی‌ها.',
    estimated_base_price: 2500000,
    currency: 'تومان',
    icon: 'Server',
    is_active: true,
    documents: [
      'آدرس محل اجرا و ساعات مجاز بازدید',
      'تعداد کاربران، طبقات و نقاط شبکهٔ موردنیاز',
      'فهرست تجهیزات موجود مانند روتر، سوئیچ و اکسس‌پوینت',
    ],
    steps: [
      'شرح نیاز و اطلاعات اولیه را برای کارشناسان ارسال کنید.',
      'بازدید یا جلسهٔ بررسی فنی هماهنگ می‌شود.',
      'طرح اجرا، برآورد و زمان‌بندی نهایی برای تأیید ارائه می‌شود.',
    ],
    faq: [
      { question: 'آیا پیش از اجرا بازدید انجام می‌شود؟', answer: 'بله، برای پروژه‌هایی که به بررسی محل نیاز دارند، زمان بازدید یا جلسهٔ آنلاین هماهنگ می‌شود.' },
      { question: 'آیا تجهیزات هم تأمین می‌شود؟', answer: 'بسته به نیاز پروژه، تأمین تجهیزات یا اجرای طرح با تجهیزات موجود قابل بررسی است.' },
    ],
    contact_type: 'external',
    contact_url: 'https://noovinnet.ir/contact',
    cta_label: 'درخواست بررسی فنی',
    required_fields: [
      { name: 'company_name', label: 'نام شرکت یا سازمان', type: 'text', required: true },
      { name: 'user_count', label: 'تعداد تقریبی کلاینت‌ها و کاربران', type: 'number', required: true },
    ],
  },
  {
    id: 3,
    name: 'نصب و بهینه‌سازی دکل و تقویت آنتن 4G/5G',
    slug: 'antenna-booster-installation',
    category: 'ارتباطات رادیویی',
    short_description: 'سایت‌سروی میدانی، نصب آنتن‌های MIMO بیرونی و رفع نقاط کور اینترنت',
    description: 'تقویت سیگنال برای کارخانجات، کارگاه‌ها و ویلاهای حاشیه شهر که با مشکل آنتن‌دهی مواجه هستند.',
    estimated_base_price: 1800000,
    currency: 'تومان',
    icon: 'Wifi',
    is_active: true,
    documents: [
      'آدرس دقیق محل نصب و تصویر تقریبی از محیط',
      'نام اپراتور یا اپراتورهای مورد استفاده در محل',
      'شماره تماس شخص حاضر در محل برای هماهنگی بازدید',
    ],
    steps: [
      'موقعیت و مشکل آنتن‌دهی را برای کارشناس ارسال کنید.',
      'شرایط محل و امکان‌سنجی اولیه بررسی می‌شود.',
      'زمان اجرا و تجهیزات پیشنهادی پس از تأیید شما هماهنگ خواهد شد.',
    ],
    faq: [
      { question: 'آیا پیش از نصب قدرت سیگنال بررسی می‌شود؟', answer: 'بله، ارزیابی اولیه برای انتخاب محل و تجهیزات مناسب انجام می‌شود.' },
      { question: 'این خدمت برای کدام اپراتورها قابل انجام است؟', answer: 'وضعیت اپراتورهای در دسترس در محل بررسی می‌شود و راهکار متناسب با نتیجه ارائه خواهد شد.' },
    ],
    contact_type: 'external',
    contact_url: 'https://noovinnet.ir/contact',
    cta_label: 'درخواست ارزیابی محل',
    required_fields: [
      { name: 'location_address', label: 'آدرس دقیق موقعیت مکانی', type: 'text', required: true },
      { name: 'current_operator', label: 'اپراتورهای دارای سیگنال ضعیف', type: 'text', required: false },
    ],
  }
];

export const mockUserAddresses: UserAddress[] = [
  {
    id: 1,
    title: 'خانه',
    recipient_name: 'علی محمدی',
    phone: '',
    province: 'تهران',
    city: 'تهران',
    postal_code: '1234567890',
    address_line: 'تهران، سعادت آباد، خیابان سرو غربی، پلاک ۱۲، واحد ۴',
    is_default: true,
  },
  {
    id: 2,
    title: 'محل کار',
    recipient_name: 'علی محمدی',
    phone: '',
    province: 'تهران',
    city: 'تهران',
    postal_code: '0987654321',
    address_line: 'تهران، خیابان ولیعصر، نرسیده به پارک ساعی، برج نگین، طبقه ۵',
    is_default: false,
  },
];

export const iranProvinces = [
  { id: 'tehran', name: 'تهران', cities: ['تهران', 'شهریار', 'اسلامشهر', 'پردیس', 'دماوند', 'ری'] },
  { id: 'isfahan', name: 'اصفهان', cities: ['اصفهان', 'کاشان', 'نجف‌آباد', 'شاهین‌شهر', 'فولادشهر'] },
  { id: 'alborz', name: 'البرز', cities: ['کرج', 'فردیس', 'هشتگرد', 'نظرآباد', 'طالقان'] },
  { id: 'azerbaijan_east', name: 'آذربایجان شرقی', cities: ['تبریز', 'مراغه', 'مرند', 'میانه', 'اهر'] },
  { id: 'azerbaijan_west', name: 'آذربایجان غربی', cities: ['ارومیه', 'خوی', 'بوکان', 'مهاباد', 'سلماس'] },
  { id: 'ardabil', name: 'اردبیل', cities: ['اردبیل', 'پارس‌آباد', 'مشگین‌شهر', 'خلخال'] },
  { id: 'fars', name: 'فارس', cities: ['شیراز', 'مرودشت', 'جهرم', 'فسا', 'کازرون'] },
  { id: 'khorasan_razavi', name: 'خراسان رضوی', cities: ['مشهد', 'نیشابور', 'سبزوار', 'تربت حیدریه'] },
  { id: 'khuzestan', name: 'خوزستان', cities: ['اهواز', 'دزفول', 'آبادان', 'ماهشهر', 'خرمشهر'] },
  { id: 'mazandaran', name: 'مازندران', cities: ['ساری', 'بابل', 'آمل', 'قائم‌شهر', 'نوشهر'] },
  { id: 'gilan', name: 'گیلان', cities: ['رشت', 'بندر انزلی', 'لاهیجان', 'لنگرود', 'فومن'] },
];

export const initialCartItems: CartItem[] = [
  {
    id: 'cart-1',
    product_id: 1,
    product_variant_id: 101,
    product_name: 'مودم روتر 5G هوآوی مدل H112-372',
    variant_name: 'سفید استاندارد (گارانتی ۱۸ ماهه نوین‌نت)',
    sku: 'HW-5G-H112',
    unit_price: 8500000,
    currency: 'تومان',
    quantity: 1,
    subtotal: 8500000,
    image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'cart-2',
    product_id: 201,
    product_variant_id: 201,
    product_name: 'سیم‌کارت دائمی ایرانسل پیش‌شماره ۰۹۳۵ با بسته ۱۰۰ گیگ',
    variant_name: 'سیم‌کارت ۶ دانگ دائمی',
    sku: 'SIM-IRN-0935-PERM',
    unit_price: 280000,
    currency: 'تومان',
    quantity: 1,
    subtotal: 280000,
    image_url: 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?w=700&auto=format&fit=crop&q=80',
  }
];

export const mockUserProfile: UserProfile = {
  id: 101,
  name: 'علی احمدی (مدیر سیستم)',
  email: 'admin@apexstore.local',
  phone: '09120000000',
  national_id: '0019876543',
  birth_date: '۱۳۷۲/۰۵/۱۴',
  role: 'admin',
  status: 'active',
  loyalty_points: 1450,
  // A test customer has no settled wallet credit until a payment is verified.
  wallet_balance: 0,
  join_date: '۱۴۰۱/۰۸/۱۵',
  security_level: 'متوسط',
  is_2fa_enabled: false,
  email_verified: true,
  phone_verified: true,
  addresses: mockUserAddresses,
};

export const mockUserOrders: UserOrder[] = [
  {
    id: 'ord-1',
    order_number: 'ORD-7829-X',
    date: '۲۴ مهر ۱۴۰۲',
    status: 'processing',
    status_label: 'در حال پردازش',
    total_amount: 1450000,
    currency: 'تومان',
    item_count: 2,
    current_step: 2, // آماده‌سازی
    estimated_delivery: 'فردا بعد از ظهر (بین ساعت ۱۵ الی ۱۹)',
    shipping_address: 'تهران، خیابان ولیعصر، نرسیده به میدان ونک، پلاک ۱۲، واحد ۴',
    recipient_name: 'علی احمدی',
    recipient_phone: '',
    tracking_code: 'TRK-9824109852',
    payment_method: 'پرداخت آنلاین سامان‌کیش',
    items: [
      {
        product_id: 1,
        product_name: 'مودم روتر بی‌سیم و سوئیچ شبکه حرفه‌ای',
        variant_name: 'سفید مات - استاندارد',
        quantity: 1,
        unit_price: 950000,
        image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
      },
      {
        product_id: 2,
        product_name: 'موس وایرلس ارگونومیک بی‌صدا',
        variant_name: 'مشکی',
        quantity: 1,
        unit_price: 500000,
        image_url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80',
      }
    ]
  },
  {
    id: 'ord-2',
    order_number: 'ORD-6541-M',
    date: '۱۴ شهریور ۱۴۰۲',
    status: 'delivered',
    status_label: 'تحویل داده شده',
    total_amount: 890000,
    currency: 'تومان',
    item_count: 1,
    current_step: 4, // تحویل داده شده
    estimated_delivery: 'تحویل شده در تاریخ ۱۴۰۲/۰۶/۱۷',
    shipping_address: 'تهران، سعادت آباد، سرو غربی، پلاک ۱۲',
    recipient_name: 'علی احمدی',
    recipient_phone: '',
    tracking_code: 'TRK-7712390124',
    payment_method: 'کیف پول کاربری',
    items: [
      {
        product_id: 3,
        product_name: 'هدفون بی‌سیم نویز کنسلینگ Pro',
        variant_name: 'خاکستری تیره',
        quantity: 1,
        unit_price: 890000,
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
      }
    ]
  },
  {
    id: 'ord-3',
    order_number: 'ORD-5102-L',
    date: '۲۲ مرداد ۱۴۰۲',
    status: 'cancelled',
    status_label: 'لغو شده',
    total_amount: 2100000,
    currency: 'تومان',
    item_count: 1,
    shipping_address: 'تهران، خیابان ولیعصر',
    recipient_name: 'علی احمدی',
    recipient_phone: '',
    payment_method: 'کارت به کارت',
    items: [
      {
        product_id: 4,
        product_name: 'کیبورد مکانیکال گیمینگ RGB مدل K8',
        variant_name: 'سوییچ قرمز',
        quantity: 1,
        unit_price: 2100000,
        image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
      }
    ]
  },
  {
    id: 'ord-4',
    order_number: 'NN-88902',
    date: '۱۲ مهر ۱۴۰۲',
    status: 'preparing',
    status_label: 'در حال آماده‌سازی',
    total_amount: 2400000,
    currency: 'تومان',
    item_count: 2,
    current_step: 2,
    estimated_delivery: 'ارسال با پست پیشتاز (۳ روز کاری)',
    shipping_address: 'اصفهان، چهارباغ عباسی، مجتمع تجاری شهر',
    recipient_name: 'شرکت نوآوران',
    recipient_phone: '',
    tracking_code: 'TRK-4491028371',
    payment_method: 'درگاه آنلاین ملت',
    items: [
      {
        product_id: 5,
        product_name: 'اکسس پوینت میکروتیک مدل cAP XL',
        variant_name: 'سفید سقفی',
        quantity: 1,
        unit_price: 1950000,
        image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
      },
      {
        product_id: 6,
        product_name: 'کابل شبکه Cat6 تمام مس لگراند',
        variant_name: 'طول ۲۰ متر با روکش LSZH',
        quantity: 1,
        unit_price: 450000,
        image_url: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=600&auto=format&fit=crop&q=80',
      }
    ]
  }
];

export const mockSupportTickets: SupportTicket[] = [
  {
    id: 'demo-8492',
    ticket_number: 'TK-8492',
    title: 'مشکل در اتصال به سرور ابری و کانفیگ فایروال',
    department: 'پشتیبانی فنی',
    status: 'open',
    status_label: 'باز',
    priority: 'high',
    last_update: '۲ ساعت پیش',
    created_at: '۱۴۰۲/۰۷/۲۴ - ۱۱:۳۰',
    messages: [
      {
        id: 1,
        sender: 'user',
        author: 'علی احمدی',
        time: '۱۱:۳۰',
        date: '۱۴۰۲/۰۷/۲۴',
        message: 'با سلام، پس از اعمال تنظیمات جدید روی روتر میکروتیک، پورت ۸۰۸۰ بر روی سرور ابری پاسخ نمی‌دهد و با خطای Connection Timeout مواجه می‌شویم. لطفاً راهنمایی بفرمایید.'
      },
      {
        id: 2,
        sender: 'support',
        author: 'مهندس رستمی (کارشناس ارشد شبکه)',
        time: '۱۲:۱۵',
        date: '۱۴۰۲/۰۷/۲۴',
        message: 'سلام جناب احمدی عزیز. رول‌های NAT و فایروال سرور شما بررسی شد. لطفا Rule شماره ۴ در بخش IP Firewall NAT را موقتاً غیرفعال کنید و مجدداً تست بفرمایید.'
      }
    ]
  },
  {
    id: 'demo-8451',
    ticket_number: 'TK-8451',
    title: 'درخواست ارتقا پلن اینترنت سازمانی به ۵۰ مگابیت',
    department: 'فروش و تمدید',
    status: 'investigating',
    status_label: 'در انتظار / در حال بررسی',
    priority: 'medium',
    last_update: 'دیروز، ۱۴:۳۰',
    created_at: '۱۴۰۲/۰۷/۲۳ - ۰۹:۰۰',
    messages: [
      {
        id: 1,
        sender: 'user',
        author: 'علی احمدی',
        time: '۰۹:۰۰',
        date: '۱۴۰۲/۰۷/۲۳',
        message: 'با سلام، درخواست ارتقا سرویس فعلی به سرعت ۵۰ مگابیت بر ثانیه نامحدود اختصاصی را برای دفتر مرکزی داشتم. مدارک حقوقی شرکت ضمیمه گردید.'
      },
      {
        id: 2,
        sender: 'support',
        author: 'دپارتمان فروش و تمدید',
        time: '۱۴:۳۰',
        date: '۱۴۰۲/۰۷/۲۳',
        message: 'درخواست شما در سیستم ثبت شد و هم‌اکنون توسط بخش امکان‌سنجی رادیویی در حال بررسی است. نتیجه ظرف ۲۴ ساعت آینده به اطلاع شما خواهد رسید.'
      }
    ]
  },
  {
    id: 'demo-8310',
    ticket_number: 'TK-8310',
    title: 'سوال درباره فاکتور ماهانه و کسر از کیف پول',
    department: 'مالی و فاکتور',
    status: 'closed',
    status_label: 'بسته شده',
    priority: 'low',
    last_update: '۱۲ مهر ۱۴۰۲',
    created_at: '۱۴۰۲/۰۷/۱۱ - ۱۰:۱۵',
    messages: [
      {
        id: 1,
        sender: 'user',
        author: 'علی احمدی',
        time: '۱۰:۱۵',
        date: '۱۴۰۲/۰۷/۱۱',
        message: 'مبلغ ۲۵۰,۰۰۰ تومان بابت تمدید لایسنس به صورت دوبل از حساب کسر شده بود که تقاضای بررسی دارم.'
      },
      {
        id: 2,
        sender: 'support',
        author: 'خانم رضایی (حسابداری)',
        time: '۱۶:۴۰',
        date: '۱۴۰۲/۰۷/۱۲',
        message: 'مبلغ اضافه به صورت خودکار به کیف پول شما بازگشت داده شد. شناسه پیگیری مالی: REF-990184. تیکت با موفقیت بسته شد.'
      }
    ]
  }
];

export const mockActiveSessions: ActiveSession[] = [
  {
    id: 'sess-1',
    device: 'iPhone 13',
    browser: 'Safari Mobile 17.0',
    os: 'iOS 17.4',
    location: 'تهران، ایران',
    ip: '5.127.88.192',
    last_active: 'هم‌اکنون در حال استفاده',
    is_current: true,
  },
  {
    id: 'sess-2',
    device: 'کامپیوتر رومیزی (PC)',
    browser: 'Google Chrome 122.0',
    os: 'Windows 11 Pro',
    location: 'تهران، ایران',
    ip: '185.110.24.8',
    last_active: '۲ ساعت پیش',
    is_current: false,
  },
  {
    id: 'sess-3',
    device: 'MacBook Pro 14"',
    browser: 'Arc Browser 1.3',
    os: 'macOS Sonoma 14.3',
    location: 'اصفهان، ایران',
    ip: '91.99.102.44',
    last_active: '۳ روز پیش',
    is_current: false,
  }
];

export const mockWalletTransactions: WalletTransaction[] = [
  {
    id: 'tx-1',
    type: 'deposit',
    amount: 1500000,
    date: '۲۲ مهر ۱۴۰۲ - ۱۶:۴۵',
    description: 'افزایش موجودی از طریق درگاه پرداخت ملت',
    tracking_code: 'SH-88491024',
    status: 'successful',
  },
  {
    id: 'tx-2',
    type: 'purchase',
    amount: -890000,
    date: '۱۴ شهریور ۱۴۰۲ - ۱۱:۲۰',
    description: 'خرید سفارش #ORD-6541-M (هدفون بی‌سیم)',
    tracking_code: 'ORD-6541-M',
    status: 'successful',
  },
  {
    id: 'tx-3',
    type: 'refund',
    amount: 250000,
    date: '۱۲ مهر ۱۴۰۲ - ۱۶:۴۰',
    description: 'استرداد وجه مازاد تراکنش بانکی (تیکت #TK-8310)',
    tracking_code: 'REF-990184',
    status: 'successful',
  },
];

export const mockAllUsers: UserProfile[] = [
  {
    id: 1,
    name: 'علی محمدی',
    email: 'admin@noovinnet.ir',
    phone: '',
    national_id: '0019842109',
    birth_date: '۱۳۶۹/۰۴/۱۵',
      role: 'admin',
    status: 'active',
    loyalty_points: 9800,
    wallet_balance: 14500000,
    join_date: '۱۴۰۰/۰۱/۱۵',
    security_level: 'عالی',
    is_2fa_enabled: true,
    email_verified: true,
    phone_verified: true,
    addresses: [
      {
        id: 1,
        title: 'دفتر مرکزی نوین‌نت',
        recipient_name: 'علی محمدی (مدیر سیستم)',
        phone: '',
        province: 'تهران',
        city: 'تهران',
        postal_code: '1969871122',
        address_line: 'خیابان ولیعصر، تقاطع میرداماد، برج فناوری ارتباطات، طبقه ۸',
        is_default: true,
      }
    ]
  },
  {
    id: 2,
    name: 'سارا احمدی',
    email: 'sara.ahmadi@noovinnet.ir',
    phone: '',
    national_id: '0028741920',
    birth_date: '۱۳۷۳/۰۸/۲۲',
    role: 'staff',
    status: 'active',
    loyalty_points: 3400,
    wallet_balance: 2400000,
    join_date: '۱۴۰۱/۰۳/۱۰',
    security_level: 'عالی',
    is_2fa_enabled: true,
    email_verified: true,
    phone_verified: true,
    addresses: []
  },
  {
    id: 101,
    name: 'علی رضایی',
    email: 'ali.rezaei@gmail.com',
    phone: '',
    national_id: '0019876543',
    birth_date: '۱۳۷۲/۰۵/۱۴',
    role: 'customer',
    status: 'active',
    loyalty_points: 1450,
    wallet_balance: 1250000,
    join_date: '۱۴۰۱/۰۸/۱۵',
    security_level: 'متوسط',
    is_2fa_enabled: false,
    email_verified: true,
    phone_verified: true,
    addresses: mockUserAddresses,
  },
  {
    id: 102,
    name: 'محمد کریمی',
    email: 'm.karimi@yahoo.com',
    phone: '',
    national_id: '0459812034',
    birth_date: '۱۳۶۸/۱۱/۰۲',
    role: 'customer',
    status: 'active',
    loyalty_points: 820,
    wallet_balance: 500000,
    join_date: '۱۴۰۲/۰۲/۲۰',
    security_level: 'متوسط',
    is_2fa_enabled: false,
    email_verified: true,
    phone_verified: true,
    addresses: [
      {
        id: 201,
        title: 'منزل',
        recipient_name: 'محمد کریمی',
        phone: '',
        province: 'خراسان رضوی',
        city: 'مشهد',
        postal_code: '9177894120',
        address_line: 'بلوار احمدآباد، خیابان رضا، پلاک ۴۲',
        is_default: true,
      }
    ]
  },
  {
    id: 103,
    name: 'زهرا موسوی',
    email: 'z.mousavi@outlook.com',
    phone: '',
    national_id: '1289012345',
    birth_date: '۱۳۷۶/۰۲/۱۸',
    role: 'customer',
    status: 'active',
    loyalty_points: 2100,
    wallet_balance: 3800000,
    join_date: '۱۴۰۲/۰۵/۱۱',
    security_level: 'عالی',
    is_2fa_enabled: true,
    email_verified: true,
    phone_verified: true,
    addresses: [
      {
        id: 301,
        title: 'محل کار',
        recipient_name: 'زهرا موسوی',
        phone: '',
        province: 'اصفهان',
        city: 'اصفهان',
        postal_code: '8145920194',
        address_line: 'خیابان شیخ بهایی، برج صدف، طبقه ۳',
        is_default: true,
      }
    ]
  },
  {
    id: 104,
    name: 'امیرحسین تهرانی',
    email: 'amir.tehrani@gmail.com',
    phone: '',
    national_id: '0078192841',
    birth_date: '۱۳۷۰/۰۹/۳۰',
    role: 'customer',
    status: 'suspended',
    loyalty_points: 150,
    wallet_balance: 0,
    join_date: '۱۴۰۲/۰۹/۰۱',
    security_level: 'ضعیف',
    is_2fa_enabled: false,
    email_verified: false,
    phone_verified: true,
    addresses: []
  }
];

export const mockAllOrders: UserOrder[] = [
  {
    id: 'ord-8901',
    order_number: 'ORD-2023-8901',
    date: '۱۴۰۲/۰۸/۱۵ - ۱۰:۳۰',
    status: 'processing',
    status_label: 'در حال پردازش',
    total_amount: 12500000,
    currency: 'تومان',
    item_count: 2,
    current_step: 1, // در انتظار تایید
    estimated_delivery: 'ارسال با پیک اکسپرس (امروز عصر)',
    shipping_address: 'تهران، میدان ونک، خیابان ملاصدرا، پلاک ۸۲، زنگ ۳',
    recipient_name: 'علی رضایی',
    recipient_phone: '',
    tracking_code: 'EXP-8891024',
    payment_method: 'درگاه آنلاین سامان کیش',
    items: [
      {
        product_id: 1,
        product_name: 'مودم روتر 5G هوآوی مدل H112-372',
        variant_name: 'سفید مات استاندارد',
        quantity: 1,
        unit_price: 8500000,
        image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
      },
      {
        product_id: 201,
        product_name: 'سیم‌کارت دائمی ایرانسل پیش‌شماره ۰۹۳۵ با بسته ۱۰۰ گیگ',
        variant_name: 'سیم‌کارت ۶ دانگ دائمی',
        quantity: 1,
        unit_price: 4000000,
        image_url: 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?w=700&auto=format&fit=crop&q=80',
      }
    ]
  },
  {
    id: 'ord-8900',
    order_number: 'ORD-2023-8900',
    date: '۱۴۰۲/۰۸/۱۵ - ۰۹:۱۵',
    status: 'preparing',
    status_label: 'آماده‌سازی',
    total_amount: 45000000,
    currency: 'تومان',
    item_count: 1,
    current_step: 2, // آماده‌سازی
    estimated_delivery: 'تحویل به پست پیشتاز ظرف ۲۴ ساعت',
    shipping_address: 'تهران، سعادت‌آباد، خیابان سرو غربی، مجتمع مهستان، واحد ۱۲',
    recipient_name: 'سارا احمدی',
    recipient_phone: '',
    tracking_code: 'POST-44910283',
    payment_method: 'درگاه پرداخت به‌پرداخت ملت',
    items: [
      {
        product_id: 101,
        product_name: 'لپ‌تاپ لنوو ThinkPad E15 Core i7 16GB 512GB SSD',
        variant_name: 'مشکی گرافیتی با گارانتی ۱۸ ماهه سازگار',
        quantity: 1,
        unit_price: 45000000,
        image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1000&auto=format&fit=crop&q=80',
      }
    ]
  },
  {
    id: 'ord-8899',
    order_number: 'ORD-2023-8899',
    date: '۱۴۰۲/۰۸/۱۴ - ۱۸:۴۵',
    status: 'processing',
    status_label: 'در انتظار پرداخت',
    total_amount: 8200000,
    currency: 'تومان',
    item_count: 2,
    current_step: 1,
    estimated_delivery: 'در انتظار پرداخت صورت‌حساب',
    shipping_address: 'مشهد، بلوار احمدآباد، خیابان رضا، پلاک ۴۲',
    recipient_name: 'محمد کریمی',
    recipient_phone: '',
    tracking_code: 'TRK-PENDING',
    payment_method: 'کیف پول کاربری / در انتظار پرداخت',
    items: [
      {
        product_id: 301,
        product_name: 'روتر میکروتیک مدل RB4011iGS+RM',
        variant_name: '۱۰ پورت گیگابیت با پورت +SFP',
        quantity: 1,
        unit_price: 7400000,
        image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
      },
      {
        product_id: 6,
        product_name: 'کابل شبکه Cat6 تمام مس لگراند',
        variant_name: 'طول ۲۰ متر با روکش LSZH',
        quantity: 1,
        unit_price: 800000,
        image_url: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=600&auto=format&fit=crop&q=80',
      }
    ]
  },
  {
    id: 'ord-8898',
    order_number: 'ORD-2023-8898',
    date: '۱۴۰۲/۰۸/۱۴ - ۱۴:۲۰',
    status: 'shipping',
    status_label: 'ارسال شده',
    total_amount: 115000000,
    currency: 'تومان',
    item_count: 3,
    current_step: 3, // ارسال شده
    estimated_delivery: 'پست پیشتاز کد رهگیری 849201948201',
    shipping_address: 'اصفهان، خیابان شیخ بهایی، برج صدف، طبقه ۳',
    recipient_name: 'زهرا موسوی',
    recipient_phone: '',
    tracking_code: '849201948201',
    payment_method: 'درگاه آنلاین زرین‌پال',
    items: [
      {
        product_id: 102,
        product_name: 'مک‌بوک پرو ۱۴ اینچ Apple M3 Pro رم ۱۸ گیگ ۵۱۲ گیگ',
        variant_name: 'خاکستری فضایی (Space Gray)',
        quantity: 1,
        unit_price: 110000000,
        image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1000&auto=format&fit=crop&q=80',
      },
      {
        product_id: 3,
        product_name: 'هدفون بی‌سیم نویز کنسلینگ Pro',
        variant_name: 'مشکی کربنی',
        quantity: 1,
        unit_price: 5000000,
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
      }
    ]
  },
  {
    id: 'ord-8897',
    order_number: 'ORD-2023-8897',
    date: '۱۴۰۲/۰۸/۱۲ - ۱۱:۱۰',
    status: 'delivered',
    status_label: 'تحویل شده',
    total_amount: 14800000,
    currency: 'تومان',
    item_count: 1,
    current_step: 4, // تحویل شده
    estimated_delivery: 'تحویل داده شده به گیرنده در تاریخ ۱۴۰۲/۰۸/۱۳',
    shipping_address: 'شیراز، خیابان زند، مجتمع پزشکی بهار، طبقه ۲',
    recipient_name: 'دکتر علیرضا فتاحی',
    recipient_phone: '',
    tracking_code: 'DLV-9948102',
    payment_method: 'درگاه آنلاین سامان کیش',
    items: [
      {
        product_id: 302,
        product_name: 'سوئیچ ۲۴ پورت گیگابیت مدیریتی سیسکو SG350-28',
        variant_name: 'مدل رکمونت ۲۴ پورت با ۴ پورت SFP',
        quantity: 1,
        unit_price: 14800000,
        image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
      }
    ]
  },
  {
    id: 'ord-8896',
    order_number: 'ORD-2023-8896',
    date: '۱۴۰۲/۰۸/۱۰ - ۱۶:۵۰',
    status: 'cancelled',
    status_label: 'لغو شده',
    total_amount: 3200000,
    currency: 'تومان',
    item_count: 1,
    current_step: 1,
    shipping_address: 'تهران، خیابان پاسداران، بوستان دوم',
    recipient_name: 'امیرحسین تهرانی',
    recipient_phone: '',
    payment_method: 'انصراف کاربر از درگاه',
    items: [
      {
        product_id: 5,
        product_name: 'اکسس پوینت میکروتیک مدل cAP XL',
        variant_name: 'سفید سقفی',
        quantity: 1,
        unit_price: 3200000,
        image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
      }
    ]
  }
];

export const mockDiscountCoupons: DiscountCoupon[] = [
  {
    id: 'cpn-1',
    code: 'NOWRUZ1404',
    title: 'تخفیف ویژه جشنواره نوروزی',
    type: 'percentage',
    discount_type: 'percentage',
    value: 15,
    discount_value: 15,
    min_order_amount: 1000000,
    max_discount_amount: 1500000,
    usage_limit: 500,
    usage_count: 142,
    used_count: 142,
    expiry_date: '۱۴۰۴/۰۱/۱۵',
    is_active: true,
  },
  {
    id: 'cpn-2',
    code: 'FIRSTBUY',
    title: 'تخفیف خرید اول مشتریان جدید',
    type: 'fixed',
    discount_type: 'fixed',
    value: 300000,
    discount_value: 300000,
    min_order_amount: 800000,
    usage_limit: 1000,
    usage_count: 489,
    used_count: 489,
    expiry_date: '۱۴۰۴/۱۲/۲۹',
    is_active: true,
  },
  {
    id: 'cpn-3',
    code: 'MODEM5G',
    title: 'تخفیف ویژه خرید انواع مودم و سیمکارت',
    type: 'percentage',
    discount_type: 'percentage',
    value: 10,
    discount_value: 10,
    min_order_amount: 2000000,
    max_discount_amount: 800000,
    usage_limit: 200,
    usage_count: 85,
    used_count: 85,
    expiry_date: '۱۴۰۴/۰۶/۳۱',
    is_active: true,
  },
  {
    id: 'cpn-4',
    code: 'YALDA50',
    title: 'جشنواره شب یلدا (منقضی شده)',
    type: 'percentage',
    discount_type: 'percentage',
    value: 20,
    discount_value: 20,
    min_order_amount: 1500000,
    max_discount_amount: 2000000,
    usage_limit: 300,
    usage_count: 300,
    used_count: 300,
    expiry_date: '۱۴۰۳/۱۰/۰۱',
    is_active: false,
  }
];

export const initialAvailableGateways: AvailablePaymentGateway[] = [
  {
    id: 'zibal',
    name: 'zibal',
    title: 'درگاه پرداخت اینترنتی زیبال',
    display_label: 'درگاه پرداخت اینترنتی زیبال (کارت‌های بانکی عضو شتاب)',
    description: 'پرداخت امن آنلاین از طریق کلیه کارت‌های عضو شبکه بانکی کشور (شاپرک)',
    environment: 'sandbox',
    environment_label: 'محیط آزمایشی (سندباکس)',
    is_test: false,
    enabled: true,
    capabilities: ['cards_shetab', 'instant_verification', 'redirect_payment'],
    currencies: ['IRR', 'IRT'],
  },
  {
    id: 'wallet',
    name: 'wallet',
    title: 'کیف پول نوین‌نت',
    display_label: 'کسر از اعتبار کیف پول نوین‌نت',
    description: 'پرداخت آنی بدون کارمزد از مانده اعتبار حساب کاربری',
    environment: 'internal',
    environment_label: 'داخلی',
    is_test: false,
    enabled: true,
    capabilities: ['instant_settlement', 'zero_gateway_fee'],
    currencies: ['IRR', 'IRT'],
  },
];

export const initialCheckoutConfiguration: CheckoutConfiguration = {
  payment: {
    online_enabled: true,
    online_provider: 'zibal',
    zibal_sandbox: true,
    zibal_merchant: 'zibal',
    wallet_enabled: true,
    bank_transfer_enabled: false,
    default_method: 'online',
    bank_account_name: '',
    bank_card_number: '',
    gateways: initialAvailableGateways,
  },
  gateways: initialAvailableGateways,
  shipping: {
    default_method_id: 'post',
    methods: [
      { id: 'post', title: 'پست پیشتاز', description: 'ارسال سراسری با رهگیری مرسوله', enabled: true, base_cost: 450000, free_shipping_threshold: 15000000 },
      { id: 'tipax', title: 'تیپاکس', description: 'تحویل سریع در شهرهای تحت پوشش', enabled: false, base_cost: 650000, free_shipping_threshold: 0 },
      { id: 'courier', title: 'پیک شهری', description: 'ارسال فوری در محدودهٔ شهری', enabled: false, base_cost: 800000, free_shipping_threshold: 0 },
    ],
  },
};

export const initialStoreSettings: StoreSettings = {
  store_name: 'فروشگاه تخصصی نوین‌نت',
  store_slogan: 'مرجع تخصصی خرید مودم 5G، سیمکارت‌های رند و تجهیزات شبکه',
  contact_phone: '021-88997766',
  contact_email: 'support@noovinnet.ir',
  address: 'تهران، خیابان ولیعصر، نرسیده به میدان ونک، برج نگار، طبقه ۱۲',
  working_hours: 'شنبه تا چهارشنبه ۹ الی ۱۸ - پنجشنبه‌ها ۹ الی ۱۳',
  gateways: {
    zarinpal: { enabled: false, merchant_id: '' },
    mellat: { enabled: false, terminal_id: '', username: '' },
    saman: { enabled: false, merchant_id: '' },
    cod: { enabled: true }
  },
  sms_provider: 'kavenegar',
  sms_sender_number: '',
  sms_api_key: '',
  shipping_cost_default: 45000,
  free_shipping_threshold: 1500000,
  banners: [
    {
      id: 1,
      title: 'مودم‌های نسل پنجم 5G با اینترنت هدیه',
      image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=1200&auto=format&fit=crop&q=80',
      link: '/category/modem-internet'
    },
    {
      id: 2,
      title: 'سیم‌کارت‌های رند دائمی ۰۹۱۲ با اقساط ویژه',
      image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1200&auto=format&fit=crop&q=80',
      link: '/category/simcard'
    }
  ]
};
