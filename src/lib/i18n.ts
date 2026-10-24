export type Locale = "en" | "fa";
// Dates are Gregorian in both languages; Persian only changes the words
// and digits (۱۸ اکتبر ۲۰۲۶), never the calendar.
export const dateLocale = (locale: string) =>
  locale === "fa" ? "fa-IR-u-ca-gregory" : "en-GB";
export const fa: Record<string, string> = {
  "Reminder frequency and limit": "فاصله و تعداد یادآوری‌ها",
  "Applies to all shops and devices. The initial alert is immediate; these settings control its reminders.":
    "برای همهٔ مغازه‌ها و دستگاه‌ها اعمال می‌شود. اعلان اول بلافاصله ارسال می‌شود؛ این تنظیمات مربوط به یادآوری‌های بعد از آن است.",
  "Reminder interval (minutes)": "فاصلهٔ یادآوری (دقیقه)",
  "Repeat reminders": "تکرار یادآوری",
  "Until the shop acknowledges": "تا ثبت اطلاع مغازه",
  "A limited number": "تعداد محدود",
  "Reminders after the initial alert": "تعداد یادآوری بعد از اعلان اول",
  "The limit counts successful sends per device. Failed sends retry without using the limit. Zero means the initial alert only. Inbox notifications stay saved until acknowledged or resolved.":
    "تعداد برای ارسال‌های موفق هر دستگاه محاسبه می‌شود. ارسال ناموفق بدون کم‌شدن از تعداد دوباره امتحان می‌شود. صفر یعنی فقط اعلان اول. اعلان داخل صندوق تا ثبت اطلاع یا تعیین تکلیف محفوظ است.",
  "Changes apply to existing pending transfers too. Scheduling runs every minute; a device may display an alert later when it reconnects.":
    "تغییرات برای ترانسفرهای بی‌پاسخ قبلی هم اعمال می‌شود. زمان‌بندی هر دقیقه اجرا می‌شود؛ دستگاه قطع از اینترنت ممکن است اعلان را پس از اتصال نمایش دهد.",
  "Save reminder settings": "ذخیرهٔ تنظیمات یادآوری",
  "Reminder settings saved": "تنظیمات یادآوری ذخیره شد",
  "Could not load reminder settings. Please retry.":
    "دریافت تنظیمات یادآوری ناموفق بود. دوباره تلاش کنید.",
  "Could not save reminder settings. Please retry.":
    "ذخیرهٔ تنظیمات یادآوری ناموفق بود. دوباره تلاش کنید.",
  "Enter valid reminder settings.": "مقادیر معتبر برای یادآوری وارد کنید.",
  NOTIFICATION_SETTINGS_UPDATED: "تغییر تنظیمات یادآوری اعلان",

  "Incoming transfers": "ترانسفرهای ورودی",
  "General settings": "تنظیمات عمومی",
  "In-app notifications are always on.":
    "اعلان داخل برنامه برای همه کاربران روشن است.",
  "Enable alerts on this device so incoming transfers reach you when the app is closed.":
    "برای اطلاع از ترانسفرها حتی وقتی برنامه بسته است، اعلان این دستگاه را فعال کنید.",
  "Devices and help": "دستگاه‌ها و راهنما",
  "Previously allowed devices connect automatically. New devices need one browser approval.":
    "دستگاه‌هایی که قبلاً مجوز داده‌اند خودکار متصل می‌شوند. دستگاه جدید فقط یک بار به تأیید مجوز مرورگر نیاز دارد.",
  "Open a transfer to read the full notification.":
    "برای خواندن متن کامل، ردیف ترانسفر را باز کنید.",
  Acknowledged: "مطلع شده‌اید",
  Resolved: "تعیین تکلیف شده",

  "device deliveries failed and are retrying automatically. Inbox notifications remain available.":
    "ارسال اعلان دستگاه ناموفق بوده و خودکار دوباره امتحان می‌شود. اعلان‌های کامل در صندوق در دسترس‌اند.",
  Notifications: "مرکز اعلان‌ها",
  "incoming transfers need acknowledgment":
    "ترانسفر ورودی در انتظار ثبت اطلاع مغازه",
  "Review notifications": "بررسی اعلان‌ها",
  "Reminders repeat every 5 minutes until your shop explicitly acknowledges.":
    "یادآوری هر ۵ دقیقه تا ثبت صریح اطلاع مغازه ادامه دارد.",
  "Notification connection interrupted. Retrying automatically; pending alerts remain saved.":
    "ارتباط اعلان‌ها قطع شده است. اتصال خودکار دوباره امتحان می‌شود؛ اعلان‌های بی‌پاسخ محفوظ‌اند.",
  "Incoming transfers remain here until acknowledged or resolved. Opening a notification does not stop reminders.":
    "ترانسفرهای ورودی تا ثبت اطلاع یا تعیین تکلیف در اینجا می‌مانند. بازکردن اعلان یادآوری را متوقف نمی‌کند.",
  "Notification delivery": "تنظیمات دریافت اعلان",
  "The full notification is saved in your inbox. Device notifications may shorten long text; open the inbox to read every item and remark.":
    "متن کامل اعلان در این صندوق ذخیره می‌شود. اعلان دستگاه ممکن است متن بلند را کوتاه کند؛ برای مشاهده تمام اقلام و توضیحات، مرکز اعلان‌ها را باز کنید.",
  "Enable device notifications": "فعال‌کردن اعلان دستگاه",
  "Check this device": "بررسی اعلان این دستگاه",
  "Enabling…": "در حال فعال‌سازی…",
  "Enable sound reminders": "فعال‌کردن یادآوری صوتی",
  "Sound reminders on": "یادآوری صوتی روشن است",
  "This device is registered": "این دستگاه ثبت شده است",
  "This device is not registered": "اعلان این دستگاه فعال نیست",
  "Background notifications are not configured. Contact your administrator.":
    "اعلان پس‌زمینه هنوز تنظیم نشده است؛ با مدیر سامانه تماس بگیرید.",
  "Background notification worker is unavailable. Contact your administrator; inbox alerts remain saved.":
    "سرویس ارسال اعلان پس‌زمینه در دسترس نیست. به مدیر اطلاع دهید؛ اعلان‌های صندوق محفوظ‌اند.",
  "Device delivery depends on permission, connectivity and operating system settings. Sound needs an open app and must be enabled after opening it.":
    "نمایش اعلان دستگاه به مجوز، اتصال و تنظیمات سیستم‌عامل وابسته است. یادآوری صوتی نیاز به بازبودن برنامه و فعال‌سازی پس از بازکردن آن دارد.",
  "Registered devices": "دستگاه‌های ثبت‌شده",
  Device: "دستگاه",
  "Remove device": "حذف دستگاه",
  "Needs acknowledgment": "نیازمند ثبت اطلاع",
  "All notifications": "همه اعلان‌ها",
  Refresh: "به‌روزرسانی",
  "Loading notifications…": "در حال دریافت اعلان‌ها…",
  "Acknowledge transfer": "از ترانسفر مطلع شدم",
  "Saving acknowledgment…": "در حال ثبت اطلاع…",
  "Acknowledgment saved. Reminders for this transfer have stopped for your shop.":
    "اطلاع مغازه ثبت شد. یادآوری این ترانسفر برای مغازه شما متوقف شد.",
  "Acknowledged by": "ثبت اطلاع توسط",
  "Reminders stopped because this transfer was received or rejected.":
    "یادآوری به علت دریافت یا ردشدن ترانسفر متوقف شده است.",
  "Notification not found or access has changed.":
    "اعلان پیدا نشد یا دسترسی شما تغییر کرده است.",
  "No notifications yet.": "هنوز اعلانی ثبت نشده است.",
  "All incoming transfers have been acknowledged.":
    "اطلاع همه ترانسفرهای ورودی ثبت شده است.",
  "transfers have waited over 30 minutes for acknowledgment.":
    "ترانسفر بیش از ۳۰ دقیقه در انتظار ثبت اطلاع مانده است.",
  "Shops needing notification setup": "مغازه‌های نیازمند تنظیم اعلان",
  pending: "در انتظار اطلاع",
  "active recipients": "گیرنده فعال",
  "registered devices": "دستگاه ثبت‌شده",
  "Manage shop access": "مدیریت دسترسی مغازه‌ها",
  "Could not check notification devices. Please retry.":
    "بررسی دستگاه‌های اعلان ممکن نشد. دوباره تلاش کنید.",
  "Could not remove notification device. Please retry.":
    "حذف دستگاه اعلان ممکن نشد. دوباره تلاش کنید.",
  "Background notifications need HTTPS and a supported browser. On iPhone, add this app to your Home Screen first.":
    "اعلان پس‌زمینه به HTTPS و مرورگر پشتیبانی‌شده نیاز دارد. در آیفون ابتدا برنامه را به صفحه اصلی اضافه کنید.",
  "Notifications are blocked. Allow notifications in your browser and device settings, then try again.":
    "اعلان‌ها مسدودند. مجوز اعلان را در تنظیمات مرورگر و دستگاه فعال کنید و دوباره تلاش کنید.",
  "BUZZ notifications enabled": "اعلان‌های BUZZ فعال شد",
  "Incoming transfers will appear here. Review and acknowledge them in your notification inbox.":
    "ترانسفرهای ورودی در اینجا اعلام می‌شوند. آن‌ها را در مرکز اعلان‌ها بررسی و اطلاع خود را ثبت کنید.",
  "Sound could not be enabled. Please try again.":
    "فعال‌کردن صدا ممکن نشد. دوباره تلاش کنید.",
  "Sound is not supported by this browser.":
    "این مرورگر از یادآوری صوتی پشتیبانی نمی‌کند.",
  "Notification not found": "اعلان پیدا نشد",
  "Unsupported push service": "سرویس اعلان دستگاه پشتیبانی نمی‌شود",
  "Device limit reached. Remove an old notification device first.":
    "حداکثر ۱۰ دستگاه قابل ثبت است. ابتدا یکی از دستگاه‌های قبلی را حذف کنید.",

  "New access code": "کد ورود جدید",
  "Save access code": "ذخیره کد ورود",
  "Enter your access code": "کد ورود خود را وارد کنید",
  "This access code is already assigned.":
    "این کد ورود قبلاً به کاربر دیگری اختصاص داده شده است.",
  "Choose either a new code or revocation.":
    "تغییر کد یا ابطال را جداگانه انجام دهید.",
  "User saved. The access code stays valid until you change or revoke it.":
    "کاربر ذخیره شد. کد ورود تا زمان تغییر یا ابطال معتبر می‌ماند.",
  "Access code saved. It stays valid until changed or revoked.":
    "کد ورود ذخیره شد و تا زمان تغییر یا ابطال معتبر می‌ماند.",
  "Choose 8–32 English letters or digits. Codes ignore letter case and stay valid until changed or revoked.":
    "کد دلخواه ۸ تا ۳۲ نویسه‌ای با حروف انگلیسی یا عدد تعیین کنید؛ خط تیره و زیرخط هم مجاز است. بزرگی حروف تفاوتی ندارد. کد تا زمان تغییر یا ابطال معتبر است.",

  "Close menu": "بستن منو",
  "Select date": "انتخاب تاریخ",
  "Gregorian calendar": "تقویم میلادی",
  "Gregorian calendar · Use arrow keys to move and Enter to select.":
    "تقویم میلادی · با کلیدهای جهت حرکت کنید و با Enter تاریخ را انتخاب کنید.",
  "Previous month": "ماه قبل",
  "Next month": "ماه بعد",
  Month: "ماه",
  Year: "سال",
  Today: "امروز",
  "Clear date": "پاک کردن تاریخ",

  "Edit location": "ویرایش مکان",
  "Access code": "کد ورود",
  "Use access code": "ورود با کد",
  "Administrator sign in": "ورود مدیر",
  "Invalid access credentials": "کد ورود یا اطلاعات حساب صحیح نیست.",
  "Menu permissions": "دسترسی منوها",
  "User transfers": "انتقال‌های کاربر",
  "All menus": "تمام منوها",
  "All locations": "تمام مکان‌ها",
  "Manage access code": "مدیریت کد ورود",
  "Generate new code": "صدور کد جدید",
  "Revoke code": "ابطال کد",
  "Access code issued": "کد ورود صادر شد",
  "Copy access code": "کپی کد ورود",
  "A secure access code will be generated automatically.":
    "کد ورود امن به‌صورت خودکار ساخته می‌شود.",
  "Copy this code now and give it privately to the user. It cannot be viewed again.":
    "کد را اکنون کپی کنید و خصوصی به کاربر تحویل دهید. نمایش دوبارهٔ آن ممکن نیست.",
  "Replacing or revoking the code signs out all existing sessions.":
    "با تعویض یا ابطال کد، تمام نشست‌های قبلی کاربر بسته می‌شوند.",
  "You do not have access to this menu":
    "شما اجازهٔ دسترسی به این منو را ندارید.",
  "This field is required.": "تکمیل این فیلد الزامی است.",
  "The entered value is too short.": "مقدار واردشده کوتاه‌تر از حد مجاز است.",
  "The entered value is too long.": "مقدار واردشده طولانی‌تر از حد مجاز است.",
  "Enter a valid email address.": "آدرس ایمیل معتبر وارد کنید.",
  "The entered format is invalid.": "قالب مقدار واردشده صحیح نیست.",
  "The value is below the allowed minimum.": "مقدار از حداقل مجاز کمتر است.",
  "The value exceeds the allowed maximum.": "مقدار از حداکثر مجاز بیشتر است.",
  "Enter a valid transfer date.": "تاریخ انتقال معتبر وارد کنید.",
  "Remarks must not exceed 2000 characters.":
    "توضیحات نباید بیش از ۲۰۰۰ نویسه باشد.",

  Requests: "طلبیه‌ها",
  "New request": "طلبیه جدید",
  "Ask another location for items. It sets what it can send, and confirming creates the transfer.":
    "از مغازه دیگر کالا بخواهید. آن مغازه تعدادی را که می‌تواند بفرستد تعیین می‌کند و با تأیید، ترانسفر ساخته می‌شود.",
  "Requests to us": "طلبیه‌های رسیده",
  "Our requests": "طلبیه‌های ما",
  "All requests": "همه طلبیه‌ها",
  "Request number": "شماره طلبیه",
  Open: "باز",
  Fulfilled: "انجام‌شده",
  Declined: "رد شده",
  Cancelled: "لغو شده",
  "No requests yet": "هنوز طلبیه‌ای ثبت نشده",
  Items: "اقلام",
  "Awaiting your reply": "منتظر پاسخ شما",
  "View request": "نمایش طلبیه",
  "Please complete both locations and at least one valid item.":
    "هر دو مکان و حداقل یک کالای معتبر را تکمیل کنید.",
  "Request details": "جزئیات طلبیه",
  "Request from": "درخواست از مکان",
  "Deliver to": "تحویل به",
  "Optional notes for this request": "یادداشت اختیاری برای این طلبیه",
  "Requested items": "اقلام درخواستی",
  "Send request": "ارسال طلبیه",
  "Transfer created": "ترانسفر ساخته شد",
  "Set the quantity you can send for each item. Remove the items you do not have, then confirm to create the transfer.":
    "برای هر کالا تعدادی را که می‌توانید بفرستید بنویسید. کالاهایی را که ندارید حذف کنید، سپس تأیید کنید تا ترانسفر ساخته شود.",
  Requested: "درخواستی",
  Sent: "ارسالی",
  "Not available": "موجود نیست",
  "Restore item": "بازگرداندن کالا",
  "Cancel request": "لغو طلبیه",
  "Decline request": "رد طلبیه",
  "Save progress": "ذخیره موقت",
  "Keep at least one item, or decline the request.":
    "حداقل یک کالا را نگه دارید یا طلبیه را رد کنید.",
  "Confirm and create transfer": "تأیید و ساخت ترانسفر",
  "A confirmed transfer is created with the quantities below and the request is closed.":
    "یک ترانسفر تأییدشده با همین تعدادها ساخته می‌شود و طلبیه بسته می‌شود.",
  "The request is closed without a transfer. The requester sees that it was declined.":
    "طلبیه بدون ترانسفر بسته می‌شود و درخواست‌کننده می‌بیند که رد شده است.",
  "The request is withdrawn and can no longer be filled.":
    "طلبیه پس گرفته می‌شود و دیگر قابل تکمیل نیست.",
  "From request": "از طلبیه",
  "Request not found": "طلبیه پیدا نشد",
  "Request access denied": "دسترسی به این طلبیه مجاز نیست",
  "This request is already closed": "این طلبیه قبلاً بسته شده است",
  "The request changed. Refresh and retry.":
    "طلبیه تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.",
  REQUEST_CREATED: "ثبت طلبیه",
  REQUEST_FULFILLED: "تأیید طلبیه و ساخت ترانسفر",
  REQUEST_CANCELLED: "لغو طلبیه",
  REQUEST_DECLINED: "رد طلبیه",
  REQUEST_DELETED: "حذف طلبیه",
  "Delete request": "حذف طلبیه",
  "The request is permanently deleted. A full copy is kept in the audit log.":
    "طلبیه برای همیشه حذف می‌شود. یک نسخه کامل در گزارش فعالیت نگهداری می‌شود.",
  "The transfer created from it is not deleted; delete it separately if needed.":
    "ترانسفری که از آن ساخته شده حذف نمی‌شود؛ در صورت نیاز آن را جداگانه حذف کنید.",
  "Inventory transfer document": "سند انتقال موجودی",
  Workspace: "فضای کاری",
  Overview: "نمای کلی",
  "New transfer": "انتقال جدید",
  "Transfer history": "تاریخچه انتقال",
  Products: "محصولات",
  Locations: "مکان‌ها",
  Users: "کاربران",
  Settings: "تنظیمات",
  "Audit log": "گزارش فعالیت",
  Administration: "مدیریت",
  "Internal transfers": "انتقال داخلی",
  "Sign out": "خروج",
  Search: "جستجو",
  "Create transfer": "ایجاد انتقال",
  "Transfer details": "جزئیات انتقال",
  "Transfer items": "اقلام انتقال",
  "From location": "مکان مبدأ",
  "To location": "مکان مقصد",
  "Select location": "انتخاب مکان",
  "Transfer date": "تاریخ انتقال",
  "Transfer number": "شماره انتقال",
  "Assigned on confirmation": "هنگام تأیید تعیین می‌شود",
  Draft: "پیش‌نویس",
  Confirmed: "تأیید شده",
  Pending: "در انتظار بررسی",
  Approved: "تصویب شده",
  Rejected: "رد شده",
  Received: "دریافت شده",
  "Code / Barcode": "کد / بارکد",
  "Product description": "شرح محصول",
  Quantity: "تعداد",
  Unit: "واحد",
  Actions: "عملیات",
  "Scan or enter code": "اسکن یا ورود کد",
  "Description appears automatically": "شرح به صورت خودکار نمایش داده می‌شود",
  "No defined unit": "واحد تعریف نشده",
  "No unit": "بدون واحد",
  Remove: "حذف",
  "Add unit": "افزودن واحد",
  "Numbers are the first letters of the source and destination and one shared counter, e.g. MA-0001.":
    "شماره از حرف اول مبدا و مقصد و یک شمارنده مشترک ساخته می‌شود، مثل MA-0001.",
  "The next number must be greater than every number already used":
    "شماره بعدی باید از همه شماره‌های استفاده‌شده بزرگ‌تر باشد",
  "Item note": "یادداشت قلم",
  "Note for this item": "یادداشت برای این قلم",
  "Add a note": "افزودن یادداشت",
  "Add item": "افزودن کالا",
  "Remove item": "حذف کالا",
  Remarks: "توضیحات",
  "Optional notes for this transfer": "یادداشت اختیاری برای این انتقال",
  "Save draft": "ذخیره پیش‌نویس",
  "Draft saved": "پیش‌نویس ذخیره شد",
  "Confirm Transfer": "تأیید انتقال",
  "Review transfer": "بازبینی انتقال",
  "Review the document before confirming.":
    "پیش از تأیید، سند را بازبینی کنید.",
  "Total item lines": "تعداد ردیف‌ها",
  "Total quantity": "مجموع تعداد",
  Cancel: "انصراف",
  "Confirm and generate PDF": "تأیید و ایجاد PDF",
  "Transfer Confirmed Successfully": "انتقال با موفقیت تأیید شد",
  "Transfer No": "شماره انتقال",
  "Download PDF": "دانلود PDF",
  "Share via WhatsApp": "اشتراک در واتساپ",
  "Create another transfer": "ایجاد انتقال دیگر",
  "Preview / Print": "پیش‌نمایش / چاپ",
  "Preparing PDF…": "در حال ایجاد PDF…",
  "Retry PDF": "تلاش مجدد برای PDF",
  "The transfer is saved. PDF generation can be retried safely.":
    "انتقال ذخیره شده است. می‌توانید ایجاد PDF را دوباره امتحان کنید.",
  "The PDF has downloaded. Attach it manually in WhatsApp.":
    "فایل PDF دانلود شد. آن را به صورت دستی در واتساپ پیوست کنید.",
  "Open WhatsApp": "باز کردن واتساپ",
  "File shared using your device.": "فایل از طریق دستگاه شما اشتراک‌گذاری شد.",
  "Choose WhatsApp from your device’s share menu.":
    "واتساپ را از فهرست اشتراک دستگاه انتخاب کنید.",
  "Product not found. Check the exact code.":
    "محصول یافت نشد. کد دقیق را بررسی کنید.",
  "Multiple products match. Ask an administrator to review.":
    "چند محصول مطابقت دارند. برای بررسی با مدیر تماس بگیرید.",
  "Enter a positive quantity with up to 3 decimal places.":
    "تعداد مثبت با حداکثر ۳ رقم اعشار وارد کنید.",
  "Product already added": "محصول قبلاً اضافه شده است",
  "Update existing quantity": "افزودن به تعداد موجود",
  "Keep separate row": "نگهداری ردیف جداگانه",
  "Resolve this duplicate before continuing.":
    "پیش از ادامه، کالای تکراری را تعیین تکلیف کنید.",
  "All transfers": "همه انتقال‌ها",
  "Awaiting review": "در انتظار بررسی",
  "Approved transfers": "انتقال‌های تصویب شده",
  "Catalog products": "محصولات کاتالوگ",
  "Recent transfers": "انتقال‌های اخیر",
  "View all": "نمایش همه",
  "No transfers yet": "هنوز انتقالی ثبت نشده",
  "Your next transfer starts here.": "انتقال بعدی خود را از اینجا شروع کنید.",
  "No products found": "محصولی یافت نشد",
  "Import catalog": "ورود کاتالوگ",
  "Search code, barcode or description": "جستجوی کد، بارکد یا شرح",
  Status: "وضعیت",
  Date: "تاریخ",
  Route: "مسیر",
  "Created by": "ایجادکننده",
  Previous: "قبلی",
  Next: "بعدی",
  "Review conflicts": "بررسی مغایرت‌ها",
  "Catalog import": "ورود کاتالوگ",
  Source: "منبع",
  "Choose workbook": "انتخاب فایل اکسل",
  "Item code column": "ستون کد کالا",
  "Description column": "ستون شرح",
  "Barcode column": "ستون بارکد",
  "Unit column": "ستون واحد",
  "Not supplied": "ارائه نشده",
  "Preview import": "پیش‌نمایش ورود",
  "Import validated rows": "ورود ردیف‌های معتبر",
  Rows: "ردیف‌ها",
  Conflicts: "مغایرت‌ها",
  "Keep existing": "حفظ مقدار موجود",
  "Accept proposed": "پذیرش مقدار پیشنهادی",
  Existing: "موجود",
  Proposed: "پیشنهادی",
  "Product codes and barcodes are matched exactly. Units come from the (1xN) pack size in the name.":
    "کدها و بارکدها دقیق تطبیق داده می‌شوند. واحدها از اندازه بسته (1xN) در نام خوانده می‌شوند.",
  "Product codes and barcodes are matched exactly. Units are never inferred.":
    "کدها و بارکدها دقیق تطبیق داده می‌شوند. واحدها حدس زده نمی‌شوند.",
  "Add location": "افزودن مکان",
  "Location name": "نام مکان",
  Name: "نام",
  Email: "ایمیل",
  Password: "رمز عبور",
  Role: "نقش",
  Administrator: "مدیر",
  Staff: "کارمند",
  Active: "فعال",
  Inactive: "غیرفعال",
  "Create user": "ایجاد کاربر",
  "Accessible locations": "مکان‌های مجاز",
  Deactivate: "غیرفعال کردن",
  Activate: "فعال کردن",
  "Reset password": "بازنشانی رمز عبور",
  Save: "ذخیره",
  "Transfer prefix": "پیشوند شماره انتقال",
  "Numbering sequence": "ترتیب شماره‌گذاری",
  "Last reserved number": "آخرین شماره رزرو شده",
  Action: "عملیات",
  Actor: "کاربر",
  Target: "هدف",
  Approve: "تصویب",
  Reject: "رد کردن",
  "Mark received": "ثبت دریافت",
  Back: "بازگشت",
  "Sign in": "ورود",
  "Work moves better together.": "گردش کالا، ساده و منظم.",
  "Secure access to your inventory transfers.":
    "دسترسی امن به انتقال‌های موجودی.",
  "Sign in to BUZZ": "ورود به BUZZ",
  "Use your company account to continue.": "با حساب شرکتی خود ادامه دهید.",
  "Your company email": "ایمیل شرکتی شما",
  "Signing in…": "در حال ورود…",
  "Contact your administrator for account access.":
    "برای دریافت حساب با مدیر تماس بگیرید.",
  "Keyboard ready": "آماده ورود با صفحه‌کلید",
  "Enter code": "ورود کد",
  "Identify product": "شناسایی محصول",
  "Enter quantity": "ورود تعداد",
  "Next item": "کالای بعدی",
  "Review and confirm": "بازبینی و تأیید",
  "Please wait…": "لطفاً صبر کنید…",
  "Loading…": "در حال بارگذاری…",
  Retry: "تلاش مجدد",
  "Saved drafts": "پیش‌نویس‌های ذخیره‌شده",
  "Open draft": "باز کردن پیش‌نویس",
  "Confirmed documents are permanent. Administrator approval is tracked separately.":
    "اسناد تأییدشده دائمی هستند. تصویب مدیر جداگانه ثبت می‌شود.",
  "New location": "مکان جدید",
  "No locations configured": "مکانی تعریف نشده است",
  "No records": "رکوردی موجود نیست",
  "Edit product": "ویرایش محصول",
  Barcodes: "بارکدها",
  Units: "واحدها",
  "Separate multiple values with |": "مقادیر متعدد را با | جدا کنید",
  "New product": "محصول جدید",
  "Add product": "افزودن محصول",
  "Product code": "کد محصول",
  "Outer unit for (1xN)": "واحد بیرونی برای (1xN)",
  "Detect units from description": "تشخیص واحدها از روی شرح",
  "(1xN) gives the outer unit and PCS; (1xNxM) gives CTN, BOX and PCS. No pack size, no units.":
    "(1xN) یعنی واحد بیرونی و PCS؛ (1xNxM) یعنی CTN و BOX و PCS. بدون پرانتز، بدون واحد.",
  "This code or barcode already belongs to a product":
    "این کد یا بارکد قبلاً برای محصول دیگری ثبت شده است",
  "Save changes": "ذخیره تغییرات",
  "Select a product to edit its verified identifiers and units.":
    "برای ویرایش شناسه‌ها و واحدهای معتبر، محصولی را انتخاب کنید.",
  Filter: "فیلتر",
  "Start date": "از تاریخ",
  "End date": "تا تاریخ",
  "All statuses": "همه وضعیت‌ها",
  Edit: "ویرایش",
  Approval: "تصویب",
  Document: "سند",
  "Access is checked on the server.": "دسترسی در سرور بررسی می‌شود.",
  "Changes saved": "تغییرات ذخیره شد",
  "Please complete source, destination and at least one valid item.":
    "مبدأ، مقصد و حداقل یک کالای معتبر را تکمیل کنید.",
  "Transfer could not be confirmed. Retry with the same draft.":
    "تأیید انتقال انجام نشد. همان پیش‌نویس را دوباره امتحان کنید.",
  "Import complete": "ورود اطلاعات انجام شد",
  "Review source conflicts before applying updates.":
    "پیش از اعمال تغییرات، مغایرت منابع را بررسی کنید.",
  "Ready for your next transfer": "آماده انتقال بعدی شما",
  "Move stock. Keep clarity.": "انتقال کالا با شفافیت کامل.",
  "Prepare, confirm and share inventory transfer documents.":
    "اسناد انتقال موجودی را آماده، تأیید و ارسال کنید.",
  "View transfer": "نمایش انتقال",
  items: "کالا",
  "Location access denied": "دسترسی به مکان مجاز نیست",
  "Administrator access required": "دسترسی مدیر لازم است",
  "Please sign in": "لطفاً وارد شوید",
  "Invalid email or password": "ایمیل یا رمز عبور نادرست است",
  "Source and destination must differ": "مبدأ و مقصد باید متفاوت باشند",
  Unknown: "نامشخص",
  "Lookup failed. Retry the code.": "جستجو ناموفق بود. کد را دوباره وارد کنید.",
  "Drafts are saved to the server.": "پیش‌نویس‌ها در سرور ذخیره می‌شوند.",
  "No pending conflicts": "مغایرتی در انتظار بررسی نیست",
  "Download first, then open WhatsApp and attach the PDF.":
    "ابتدا دانلود کنید، سپس واتساپ را باز کرده و فایل PDF را پیوست کنید.",
  Worksheet: "کاربرگ",
  "No worksheet selected": "کاربرگی انتخاب نشده",
  Print: "چاپ",
  "User updated": "کاربر به‌روزرسانی شد",
  "Edit user": "ویرایش کاربر",
  "Current catalog value": "مقدار فعلی کاتالوگ",
  "Original source value": "مقدار اصلی منبع",
  "Next transfer number": "شماره انتقال بعدی",
  "Request numbering": "شماره‌گذاری طلبیه",
  "Next request number": "شماره طلبیه بعدی",
  "Requests have their own counter, e.g. REQ-0001. The transfer made from a request is numbered like every transfer: the first letters of its source and destination and the transfer counter, e.g. NM-0012.":
    "طلبیه‌ها شمارندهٔ خودشان را دارند، مثل REQ-0001. انتقالی که از طلبیه ساخته می‌شود مثل همهٔ انتقال‌ها شماره می‌گیرد: حرف اول مبدا و مقصد و شمارندهٔ انتقال، مثل NM-0012.",
  "Product changed. Refresh the conflict review before applying changes.":
    "محصول تغییر کرده است. پیش از اعمال تغییرات، بازبینی را تازه کنید.",
  "Product data changed. Look up the product again before confirmation.":
    "اطلاعات محصول تغییر کرده است. پیش از تأیید، کد را دوباره جستجو کنید.",
  "Your workspace. Ready to move.": "فضای کاری شما، آماده انتقال.",
  "Create the first administrator account using your private setup link.":
    "اولین حساب مدیر را با پیوند خصوصی راه‌اندازی خود ایجاد کنید.",
  "Secure first-time setup": "راه‌اندازی امن اولیه",
  "FIRST-TIME SETUP": "راه‌اندازی اولیه",
  "Welcome to BUZZ": "به BUZZ خوش آمدید",
  "Set up your administrator account.": "حساب مدیر خود را راه‌اندازی کنید.",
  "Create administrator": "ایجاد حساب مدیر",
  "Your password is hashed before it is saved.":
    "رمز عبور شما پیش از ذخیره، هش می‌شود.",
  "The next number must be greater than the last reserved number":
    "شماره بعدی باید از آخرین شماره رزرو شده بزرگ‌تر باشد",
  "Identifiers conflict with another product":
    "شناسه‌ها با محصول دیگری تداخل دارند",
  "Already resolved": "قبلاً بررسی شده است",
  "Resolve the identifier collision manually first":
    "ابتدا تداخل شناسه را به صورت دستی برطرف کنید",
  "The operation could not be completed. Your entered data is retained; please retry.":
    "عملیات انجام نشد. اطلاعات وارد شده حفظ شده است؛ دوباره امتحان کنید.",
  "This identifier is already in use": "این شناسه قبلاً استفاده شده است",
  "Invalid request origin": "مبدأ درخواست نامعتبر است",
  "Too many attempts. Try again in 15 minutes.":
    "تعداد تلاش‌ها زیاد است. ۱۵ دقیقه دیگر دوباره امتحان کنید.",
  "Draft access denied": "دسترسی به پیش‌نویس مجاز نیست",
  "Already confirmed": "قبلاً تأیید شده است",
  "Choose active locations": "مکان‌های فعال را انتخاب کنید",
  "Transfer access denied": "دسترسی به انتقال مجاز نیست",
  "Transfer not found": "انتقال یافت نشد",
  "Invalid status transition": "تغییر وضعیت نامعتبر است",
  "Status changed. Refresh and retry.":
    "وضعیت تغییر کرده است. صفحه را تازه کنید و دوباره امتحان کنید.",
  "You cannot deactivate yourself": "نمی‌توانید حساب خود را غیرفعال کنید",
  "Save the draft before confirmation": "پیش از تأیید، پیش‌نویس را ذخیره کنید",
  "A product is unavailable": "محصولی در دسترس نیست",
  "The catalog or draft changed. Please review and retry.":
    "کاتالوگ یا پیش‌نویس تغییر کرده است. بازبینی و دوباره امتحان کنید.",
  "Could not read workbook": "خواندن فایل اکسل ممکن نیست",
  "Maximum file size: 15 MB": "حداکثر اندازه فایل: ۱۵ مگابایت",
  "Invalid input. Please check the entered fields.":
    "ورودی نامعتبر است. اطلاعات وارد شده را بررسی کنید.",
  LOGIN: "ورود",
  LOGIN_FAILED: "ورود ناموفق",
  LOGIN_BLOCKED: "ورود مسدود شد",
  LOGOUT: "خروج",
  NOTIFICATIONS_ON: "روشن کردن اعلان",
  NOTIFICATIONS_OFF: "خاموش کردن اعلان",
  "Transfer notifications": "اعلان ترانسفرها",
  "Get a notification on this device whenever anyone confirms a transfer.":
    "هر بار کسی ترانسفری را تأیید کند، روی این دستگاه اعلان بگیرید.",
  "This browser cannot receive notifications. On iPhone, add the site to the Home Screen first and open it from there.":
    "این مرورگر نمی‌تواند اعلان دریافت کند. در آیفون ابتدا سایت را به صفحه اصلی (Add to Home Screen) اضافه کنید و از همان‌جا باز کنید.",
  "Notifications are not configured on the server yet.":
    "اعلان‌ها هنوز روی سرور تنظیم نشده‌اند.",
  "Send a test": "ارسال اعلان آزمایشی",
  "Missing on this deployment": "در این دیپلوی پیدا نشد",
  "API keys": "کلیدهای API",
  "Programs such as the QBM entry app use a key to read confirmed transfers and their items, and to mark them as entered in QBM. A key cannot change or delete anything else.":
    "برنامه‌هایی مثل برنامه ورود QBM با کلید، ترانسفرهای تأییدشده و اقلامشان را می‌خوانند و واردشده در QBM علامت می‌زنند. کلید به هیچ چیز دیگری دسترسی ندارد و چیزی را تغییر یا حذف نمی‌کند.",
  Revoked: "باطل‌شده",
  "Last used": "آخرین استفاده",
  Never: "هرگز",
  "Transfers entered": "ترانسفرهای واردشده",
  "Revoke this key? Programs using it stop working.":
    "این کلید باطل شود؟ برنامه‌هایی که از آن استفاده می‌کنند دیگر کار نمی‌کنند.",
  Revoke: "باطل کردن",
  "Key name": "نام کلید",
  "Create key": "ساخت کلید",
  "New API key": "کلید API جدید",
  "Copy the key now and paste it into the program. It is not shown again; if it is lost, revoke it and create a new one.":
    "همین حالا کلید را کپی کنید و در برنامه بگذارید. دوباره نمایش داده نمی‌شود؛ اگر گم شد، باطلش کنید و کلید تازه بسازید.",
  Copied: "کپی شد",
  "Copy key": "کپی کلید",
  Done: "تمام",
  "Entered in QBM": "واردشده در QBM",
  QBM_ENTERED: "ورود به QBM",
  QBM_ENTRY_REMOVED: "حذف علامت ورود QBM",
  API_KEY_CREATED: "ساخت کلید API",
  API_KEY_REVOKED: "باطل کردن کلید API",
  API_KEY_UPDATED: "تغییر کلید API",
  "Can approve": "اجازه تصویب",
  "Allow approving": "اجازه تصویب بده",
  "Stop approving": "لغو اجازه تصویب",
  "A key allowed to approve may also approve a pending transfer after it has been entered in QBM.":
    "کلیدی که اجازه تصویب دارد، می‌تواند ترانسفر در انتظار را بعد از ورود در QBM تصویب کند.",
  "Test notification sent": "اعلان آزمایشی ارسال شد",
  "This account has no device with notifications on.":
    "هیچ دستگاهی با اعلان روشن برای این حساب ثبت نشده است.",
  "Turn off on this device": "خاموش کردن روی این دستگاه",
  "Turn on for this device": "روشن کردن روی این دستگاه",
  "Notifications turned off on this device": "اعلان‌ها روی این دستگاه خاموش شد",
  "Notifications turned on for this device": "اعلان‌ها روی این دستگاه روشن شد",
  "Notifications are blocked. Allow them in the browser settings.":
    "اعلان‌ها مسدود هستند. در تنظیمات مرورگر اجازه دهید.",
  "Devices receiving notifications": "دستگاه‌های دریافت‌کننده اعلان",
  "Email and password": "ایمیل و رمز عبور",
  "Unknown access code or email": "کد ورود یا ایمیل ناشناخته",
  "Account disabled": "حساب غیرفعال",
  "Wrong password or code": "رمز یا کد اشتباه",
  "Password reset": "بازنشانی رمز",
  "Access code changed": "تغییر کد ورود",
  "Access code revoked": "ابطال کد ورود",
  Imported: "وارد شده",
  User: "کاربر",
  "All users": "همه کاربران",
  "All events": "همه رویدادها",
  entries: "رکورد",
  Details: "جزئیات",
  "Unknown person": "شخص ناشناس",
  More: "بیشتر",
  TRANSFER_CONFIRMED: "تأیید انتقال",
  APPROVED: "تصویب",
  REJECTED: "رد",
  RECEIVED: "دریافت",
  USER_CREATED: "ایجاد کاربر",
  USER_UPDATED: "ویرایش کاربر",
  LOCATION_CREATED: "ایجاد مکان",
  LOCATION_UPDATED: "ویرایش مکان",
  SETTINGS_UPDATED: "ویرایش تنظیمات",
  PRODUCT_CREATED: "ایجاد محصول",
  PRODUCT_UPDATED: "ویرایش محصول",
  CATALOG_IMPORTED: "ورود کاتالوگ",
  CONFLICT_RESOLVED: "بررسی مغایرت",
  ADMIN_PROVISIONED: "ایجاد مدیر",
  SOURCES_RECONCILED: "تطبیق منابع",
  CONFLICTING_UNITS_HELD_FOR_REVIEW: "واحدها در انتظار بررسی",
  DRAFT_DELETED: "حذف پیش‌نویس",
  TRANSFER_DELETED: "حذف انتقال",
  BOOTSTRAP_ACCOUNT_PRESERVED: "حفظ حساب اول",
  "Delete draft": "حذف پیش‌نویس",
  "Draft deleted": "پیش‌نویس حذف شد",
  "Draft not found": "پیش‌نویس پیدا نشد",
  "This saved draft and all of its items will be removed. Drafts hold no transfer number, so none is lost.":
    "این پیش‌نویس و همهٔ اقلام آن حذف می‌شود. پیش‌نویس شمارهٔ انتقال ندارد، پس هیچ شماره‌ای از دست نمی‌رود.",
  "Last transfer number": "آخرین شمارهٔ انتقال",
  "Change number": "تغییر شماره",
  "New number": "شمارهٔ جدید",
  "Current number": "شمارهٔ فعلی",
  "Save number": "ثبت شماره",
  "Transfer number changed": "شمارهٔ انتقال تغییر کرد",
  "Another transfer already has this number":
    "این شماره قبلاً به انتقال دیگری داده شده است",
  "Use this when the number is out of step with QBM. The PDF is made again with the new number, and the next transfer number in Settings follows the highest number.":
    "وقتی شماره با QBM نمی‌خواند از این استفاده کنید. PDF با شمارهٔ جدید دوباره ساخته می‌شود و شمارهٔ انتقال بعدی در تنظیمات خودش با بالاترین شماره هماهنگ می‌شود.",
  TRANSFER_RENUMBERED: "تغییر شمارهٔ انتقال",
  "Works here": "محل کار",
  "View only": "فقط مشاهده",
  "Can sign both sides": "اجازهٔ امضای هر دو طرف",
  "Exception: may sign as both sender and receiver of the same transfer.":
    "استثنا: می‌تواند در یک انتقال هم به‌عنوان تحویل‌دهنده و هم تحویل‌گیرنده امضا کند.",
  "View only shows that location's transfers. It does not let the user send from it or sign for it.":
    "«فقط مشاهده» انتقال‌های آن مکان را نشان می‌دهد، ولی اجازهٔ ارسال از آن مکان یا امضا برای آن را نمی‌دهد.",
  Location: "مکان",
  "Delete transfer": "حذف انتقال",
  "The confirmed transfer and its saved PDF will be permanently deleted. A full copy is kept in the audit log.":
    "انتقال تأییدشده و PDF ذخیره‌شدهٔ آن برای همیشه حذف می‌شود. یک نسخهٔ کامل در گزارش رویدادها نگهداری می‌شود.",
  "Reason (optional)": "دلیل (اختیاری)",
  "Transfer changed. Refresh and retry.":
    "انتقال تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.",

  "Waiting for my signature": "در انتظار امضای من",
  "All signatures": "همهٔ امضاها",
  Signed: "امضاشده",
  Sender: "تحویل‌دهنده",
  Receiver: "تحویل‌گیرنده",
  "Your signature": "امضای شما",
  "Not signed": "امضا نشده",
  Signatures: "امضاها",
  Signature: "امضا",
  "Sender signature": "امضای تحویل‌دهنده",
  "Receiver signature": "امضای تحویل‌گیرنده",
  "Sign as sender": "امضا به‌عنوان تحویل‌دهنده",
  "Sign as receiver": "امضا به‌عنوان تحویل‌گیرنده",
  "Sign inside the box with your finger or mouse. A saved signature cannot be changed.":
    "داخل کادر با انگشت یا موس امضا کنید. امضای ذخیره‌شده قابل تغییر نیست.",
  "Signature box": "کادر امضا",
  Clear: "پاک کردن",
  "Save signature": "ثبت امضا",
  "Signature saved": "امضا ثبت شد",
  "Draw your signature first": "ابتدا امضای خود را داخل کادر بکشید",
  "This side is already signed": "این بخش قبلاً امضا شده است",
  "You cannot sign this side of the transfer":
    "شما اجازهٔ امضای این بخش از انتقال را ندارید",
  TRANSFER_SIGNED: "امضای انتقال",
  "Turn on notifications": "روشن کردن اعلان\u200cها",
  "Incoming transfers and requests must reach this device even when the app is closed. Turn on notifications to continue.":
    "ترانسفرها و طلبیه\u200cهای ورودی باید حتی وقتی برنامه بسته است به این دستگاه برسند. برای ادامه، اعلان\u200cها را روشن کنید.",
  "Tap the Share button in Safari.":
    "در Safari دکمهٔ اشتراک\u200cگذاری (Share) را بزنید.",
  "Choose Add to Home Screen, then Add.":
    "گزینهٔ Add to Home Screen و بعد Add را بزنید.",
  "Open BUZZ from the Home Screen and sign in.":
    "BUZZ را از صفحهٔ اصلی گوشی باز کنید و وارد شوید.",
  "Tap Turn on notifications and choose Allow.":
    "«روشن کردن اعلان\u200cها» را بزنید و Allow را انتخاب کنید.",
  "This browser cannot receive notifications. Open BUZZ in Chrome or Edge, or on iPhone and iPad add it to the Home Screen.":
    "این مرورگر اعلان دریافت نمی\u200cکند. BUZZ را در Chrome یا Edge باز کنید، یا در iPhone و iPad آن را به صفحهٔ اصلی اضافه کنید.",
  "Notifications are blocked for this site. Tap the lock or settings icon next to the address.":
    "اعلان\u200cها برای این سایت مسدود شده\u200cاند. روی آیکون قفل یا تنظیمات کنار آدرس سایت بزنید.",
  "Set Notifications to Allow.":
    "گزینهٔ Notifications (اعلان\u200cها) را روی Allow (اجازه) بگذارید.",
  "Come back here and tap Try again.":
    "به اینجا برگردید و «دوباره امتحان کنید» را بزنید.",
  "Try again": "دوباره امتحان کنید",
  "The PDF is ready. Tap Print again.": "PDF آماده است. دوباره «چاپ» را بزنید.",
  "Not now (ask again tomorrow)": "فعلاً نه (فردا دوباره بپرس)",
  "Require notifications on every device":
    "روشن بودن اعلان روی همهٔ دستگاه\u200cها اجباری باشد",
  "Each signed-in device must turn notifications on before it can use the app.":
    "هر دستگاهی که وارد حساب می\u200cشود، باید پیش از استفاده از برنامه اعلان\u200cها را روشن کند.",
  "Your unsent request was restored on this device.":
    "طلبیهٔ ارسال\u200cنشدهٔ شما روی این دستگاه بازیابی شد.",
  "Your unsaved transfer was restored on this device.":
    "ترانسفر ذخیره\u200cنشدهٔ شما روی این دستگاه بازیابی شد.",
  "Start over": "شروع از نو",
  "This saved draft and all of its items will be removed.":
    "این پیش\u200cنویس و همهٔ اقلام آن حذف می\u200cشود.",
  "Supplier added": "اضافه\u200cشده توسط تأمین\u200cکننده",
  "Items you add": "اقلامی که اضافه می\u200cکنید",
  "Add items that were not asked for, if you are sending them too.":
    "اگر کالایی را که خواسته نشده هم می\u200cفرستید، اینجا اضافه کنید.",
  "Added item code": "کد قلم اضافه\u200cشده",
  "Added item quantity": "مقدار قلم اضافه\u200cشده",
  "Added item unit": "واحد قلم اضافه\u200cشده",
  "Remove added item": "حذف قلم اضافه\u200cشده",
  "Look up each added item by its exact code, or remove it.":
    "هر قلم اضافه\u200cشده را با کد دقیق جست\u200cوجو کنید، یا آن را حذف کنید.",
  "The draft is too large": "پیش\u200cنویس بیش از حد بزرگ است",
  "rows to import": "ردیف برای ورود",
  "rows skipped": "ردیف رد شد",
  "These rows are skipped; every other row is imported.":
    "این ردیف‌ها وارد نمی‌شوند؛ بقیهٔ ردیف‌ها وارد می‌شوند.",
  Row: "ردیف",
  "Same code as row": "کد تکراری، مثل ردیف",
  "No item code": "کد کالا ندارد",
  "No description": "شرح ندارد",
  "Barcode already used by another item": "بارکد مال کالای دیگری است",
  "Importing…": "در حال ورود…",
  "Imported before the error": "واردشده پیش از خطا",
  "The server took too long to respond. Please retry.":
    "پاسخ سرور بیش از حد طول کشید. لطفاً دوباره تلاش کنید.",
  "The server could not complete the request. Please retry.":
    "سرور نتوانست درخواست را انجام دهد. لطفاً دوباره تلاش کنید.",
  "Clean up conflicts": "پاک‌سازی مغایرت‌ها",
  "These conflicts need no review: the same proposal waiting more than once, or a proposal that already matches the product. They are marked resolved and the clean-up is logged.":
    "این مغایرت‌ها نیازی به بررسی ندارند: پیشنهاد تکراری که چند بار ثبت شده، یا پیشنهادی که با کالای فعلی یکی است. این‌ها «بررسی‌شده» علامت می‌خورند و پاک‌سازی در گزارش رویدادها ثبت می‌شود.",
  Duplicates: "تکراری",
  "Already matching the product": "با کالای فعلی یکی است",
  "Left to review": "باقی‌مانده برای بررسی",
  "Remove unneeded conflicts": "حذف مغایرت‌های غیرلازم",
  CONFLICTS_CLEANED: "پاک‌سازی مغایرت‌ها",
  "No new notifications": "اعلان جدیدی نیست",
  Acknowledge: "مطلع شدم",
  "View details": "مشاهدهٔ جزئیات",
};
export function translate(locale: Locale, key: string): string {
  if (locale === "en") return key;
  if (fa[key]) return fa[key];
  if (key.startsWith("Invalid unit for "))
    return "واحد نامعتبر برای " + key.slice(17);
  if (key.startsWith("Review duplicate product "))
    return "محصول تکراری را بررسی کنید: " + key.slice(25);
  return key;
}
