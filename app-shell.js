/* قشرة التطبيق المشتركة لموقع المستخدم: التحقق من تسجيل الدخول، الهيدر، الفوتر،
   قواعد فتح المحاضرات، وحساب اكتمال المحاضرة في نظام الفيديوهات/الاختبارات المتعددة. */

/**
 * يتحقق أن المستخدم مسجل دخول وله سجل بيانات في قاعدة البيانات وغير محظور،
 * وإلا يُعاد توجيهه لصفحة تسجيل الدخول. عند النجاح يستدعي onReady(user, userData)
 */
function requireAuth(onReady) {
  auth.onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    const userRef = db.ref('users/' + user.uid);
    userRef.once('value')
      .then(function (snap) {
        if (snap.exists()) {
          const data = snap.val();
          if (data.blocked === true) {
            auth.signOut().then(function () {
              window.location.href = 'index.html?blocked=1';
            });
            return;
          }
          onReady(user, data);
          return;
        }
        const fallback = {
          name: user.displayName || 'مستخدم',
          email: user.email || '',
          points: 0,
          isAdmin: false,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        };
        return userRef.set(fallback).then(function () { onReady(user, fallback); });
      })
      .catch(function (err) {
        console.error(err);
        onReady(user, { name: user.displayName || '', email: user.email, points: 0, isAdmin: false });
      });
  });
}

/**
 * يرسم الهيدر الموحد داخل عنصر #appHeader
 */
function renderAppHeader(userData, opts) {
  opts = opts || {};
  const showPoints = opts.showPoints !== false;
  const header = document.getElementById('appHeader');
  if (!header) return;

  const initial = (userData.name || '؟').trim().charAt(0);

  header.innerHTML =
    '<div class="header-inner">' +
      '<div class="brand-block">' +
        '<img src="logo.png" alt="شعار المنصة" onerror="this.style.display=\'none\'">' +
        '<div class="brand-text">' +
          '<h2>' + icon('moon', 'brand-crescent icon-sm') + ' منصة أواب الإلكترونية</h2>' +
          '<span>تعلّم وتنافس واكسب النقاط</span>' +
        '</div>' +
      '</div>' +
      '<div class="header-right">' +
        (showPoints ?
          '<div class="points-badge" title="نقاطي">' +
            icon('star') +
            '<span id="pointsValue">' + (userData.points || 0) + '</span>' +
          '</div>' : ''
        ) +
        '<div class="account-menu">' +
          '<button class="account-btn" id="accountBtn" aria-label="حساب المستخدم">' +
            '<div class="avatar">' + initial + '</div>' +
          '</button>' +
          '<div class="account-dropdown" id="accountDropdown">' +
            '<a href="account.html">' + icon('user') + ' الحساب الشخصي</a>' +
            '<button class="danger" id="logoutBtn">' + icon('logout') + ' تسجيل الخروج</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  const accountBtn = document.getElementById('accountBtn');
  const dropdown = document.getElementById('accountDropdown');
  accountBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target) && e.target !== accountBtn) {
      dropdown.classList.remove('open');
    }
  });
  document.getElementById('logoutBtn').addEventListener('click', function () {
    auth.signOut().then(function () { window.location.href = 'index.html'; });
  });
}

/**
 * يرسم الفوتر الموحد داخل عنصر #siteFooter
 * روابط قناة الواتساب وتحميل التطبيق فارغة حاليًا (placeholders) لحين تجهيزها
 */
function renderFooter() {
  const footer = document.getElementById('siteFooter');
  if (!footer) return;

  const iconBtn = function (cls, iconName, title, href) {
    return '<a class="footer-icon-btn ' + cls + '" href="' + href + '" target="_blank" rel="noopener" title="' + title + '">' + icon(iconName) + '</a>';
  };

  footer.innerHTML =
    '<div class="footer-inner">' +
      '<div class="footer-social-group">' +
        '<span class="footer-social-label">تابعنا</span>' +
        '<div class="footer-icon-row">' +
          iconBtn('app', 'arrowUpRightFromSquare', 'حمّل تطبيقنا', 'https://www.appcreator24.com/app3665045-8gns96') +
          iconBtn('wa', 'whatsapp', 'قناة واتساب', 'https://whatsapp.com/channel/0029Vb4Efn45a240GzodQC1V') +
          iconBtn('tg', 'telegram', 'قناة تلجرام', 'https://t.me/awabofficial0') +
          iconBtn('tt', 'tiktok', 'تيك توك', 'https://www.tiktok.com/@awab_1223') +
          iconBtn('ig', 'instagram', 'انستجرام', 'https://www.instagram.com/awab_1223?igsh=M2FtZ284Z2lkdHh1') +
          iconBtn('fb', 'facebookF', 'فيسبوك', 'https://www.facebook.com/share/15fuYeuHfp/') +
        '</div>' +
      '</div>' +
      '<div class="footer-social-group">' +
        '<span class="footer-social-label">تواصل معنا على</span>' +
        '<div class="footer-icon-row">' +
          iconBtn('sr', 'commentDots', 'صارحني', 'https://55391054521568.sarhne.com') +
        '</div>' +
      '</div>' +
      '<p class="footer-tagline">تم تصميمه خالصًا لوجه الله</p>' +
      '<p class="footer-copyright">جميع الحقوق محفوظة لأواب © 2026</p>' +
    '</div>';
}

/**
 * يعرض بطاقة "الحساب محظور" مع زر تواصل مع الدعم الفني (رابط فارغ حاليًا)
 */
function renderBlockedNotice(container) {
  container.innerHTML =
    '<div class="blocked-card">' +
      '<div class="big-icon">' + icon('lock', 'icon-xl') + '</div>' +
      '<h2>تم وقف حسابك</h2>' +
      '<p>إذا أردت تفعيله، تواصل مع الدعم الفني للمنصة.</p>' +
      '<a class="btn btn-primary btn-sm" style="width:auto; margin:0 auto;" href="#">' + icon('headset') + ' تواصل مع الدعم الفني</a>' +
    '</div>';
}

/**
 * يحدد حالة الوصول لمحاضرة معيّنة: منشورة/مقفولة بالتاريخ/مقفولة بالترتيب
 * يرجع: { allowed, releasePassed, unlockedBySequence, reason }
 */
function getLessonAccessState(lessons, progressData, lessonId) {
  const ids = Object.keys(lessons);
  const now = Date.now();
  let previousDone = true;
  let result = null;

  ids.forEach(function (id) {
    const lesson = lessons[id];
    const done = !!(progressData[id] && progressData[id].completed);
    const releasePassed = !lesson.releaseAt || lesson.releaseAt <= now;
    const unlockedBySequence = previousDone;
    const allowed = releasePassed && unlockedBySequence;

    if (id === lessonId) {
      result = {
        allowed: allowed,
        releasePassed: releasePassed,
        unlockedBySequence: unlockedBySequence,
        reason: !releasePassed ? 'release' : (!unlockedBySequence ? 'sequence' : null)
      };
    }
    previousDone = releasePassed && done;
  });

  return result || { allowed: false, releasePassed: false, unlockedBySequence: false, reason: 'not_found' };
}

/**
 * يحسب هل المحاضرة "مكتملة" في نظام الفيديوهات/الاختبارات المتعددة:
 * - لو فيها اختبارات: لازم كل الاختبارات تكون completed
 * - لو مفيش اختبارات بس فيها فيديوهات: تكتمل بمجرد مشاهدة فيديو واحد على الأقل
 * - يرجع { completed, earnedPoints } لتحديث عقدة تقدّم المحاضرة نفسها
 */
function computeLessonCompletion(lesson, lessonProgress) {
  lessonProgress = lessonProgress || {};
  const exams = lesson.exams || {};
  const examIds = Object.keys(exams);
  const videos = lesson.videos || {};
  const videoIds = Object.keys(videos);
  const progExams = lessonProgress.exams || {};
  const progVideos = lessonProgress.videos || {};

  let earnedPoints = 0;
  Object.keys(progExams).forEach(function (examId) {
    if (progExams[examId] && progExams[examId].completed) {
      earnedPoints += progExams[examId].earnedPoints || 0;
    }
  });

  let completed;
  if (examIds.length > 0) {
    completed = examIds.every(function (id) { return progExams[id] && progExams[id].completed; });
  } else if (videoIds.length > 0) {
    completed = videoIds.some(function (id) { return progVideos[id] && progVideos[id].watched; });
  } else {
    completed = false;
  }

  return { completed: completed, earnedPoints: earnedPoints };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/** ينسّق تاريخ/وقت timestamp بالعربي المصري */
function formatArabicDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* يستخرج معرف فيديو يوتيوب من رابط بأي صيغة شائعة، بما فيها بث مباشر سابق */
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
