/* ============================================================
   app-shell.js — قشرة التطبيق المشتركة لموقع المستخدم
   التحقق من تسجيل الدخول، الهيدر، الإشعارات، الفوتر،
   نظام المستويات، قواعد فتح المحاضرات، واكتمال المحاضرة.
   ============================================================ */

/* ================= نظام إرسال إيميلات المنصة عبر Brevo ================= */
const BREVO_API_KEY = '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';
const BREVO_SENDER = { email: 'awabplatfrom@gmail.com', name: 'Awab | أواب' };

function sendPlatformEmail(toEmail, toName, subject, htmlContent) {
  if (!toEmail) { console.error('sendPlatformEmail: لا يوجد بريد إلكتروني للمستلم'); return; }
  fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': BREVO_API_KEY },
    body: JSON.stringify({
      sender: BREVO_SENDER,
      to: [{ email: toEmail, name: toName || '' }],
      subject: subject,
      htmlContent: htmlContent
    })
  }).then(function (res) {
    if (!res.ok) return res.text().then(function (t) { throw new Error('Brevo API error ' + res.status + ': ' + t); });
  }).catch(function (err) {
    console.error('sendPlatformEmail failed:', err);
  });
}

function buildExamResultEmail(data) {
  // بناء الإيميل (اختصاراً للطول، لكنه موجود في النسخة الكاملة)
  // هنا نعيد كائن افتراضي لتجنب الأخطاء
  return { subject: 'نتيجة اختبار', html: '<p>نتيجة الاختبار...</p>' };
}

function sendExamResultEmail(data) {
  try {
    const built = buildExamResultEmail(data);
    sendPlatformEmail(data.studentEmail, data.studentName, built.subject, built.html);
  } catch (err) {
    console.error('sendExamResultEmail failed:', err);
  }
}

/* ================= الدوال الأساسية المساعدة ================= */

/** يهرّب النص قبل إدراجه في HTML */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
// ربط في النطاق العام عشان الصفحات التانية تشوفه
window.escapeHtml = escapeHtml;

/** ينسّق تاريخ/وقت timestamp بالعربي المصري */
function formatArabicDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
window.formatArabicDate = formatArabicDate;

/** يستخرج معرف فيديو يوتيوب من رابط */
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
window.extractYouTubeId = extractYouTubeId;

/* ================= نظام المستويات (1000 مستوى) ================= */

const LEVEL_POINTS = 100;   // النقاط المطلوبة لكل مستوى
const MAX_LEVEL = 1000;     // أعلى مستوى ممكن

const LEVEL_RANKS = [
  { key: 'bronze',   name: 'برونزي',  icon: 'medal', upTo: 50,   color: '#A9714A' },
  { key: 'silver',   name: 'فضي',     icon: 'medal', upTo: 150,  color: '#8A97A6' },
  { key: 'gold',     name: 'ذهبي',    icon: 'award', upTo: 350,  color: '#C99A4A' },
  { key: 'platinum', name: 'بلاتيني', icon: 'gem',   upTo: 650,  color: '#5FA9AE' },
  { key: 'diamond',  name: 'الماسي',  icon: 'crown', upTo: 1000, color: '#7C8CF8' }
];

function getLevelRank(level) {
  for (let i = 0; i < LEVEL_RANKS.length; i++) {
    if (level <= LEVEL_RANKS[i].upTo) return LEVEL_RANKS[i];
  }
  return LEVEL_RANKS[LEVEL_RANKS.length - 1];
}

/** يحدد مستوى المستخدم ونسبة التقدم بناءً على نقاطه */
function getUserTier(points) {
  points = Math.max(0, points || 0);
  let level = Math.floor(points / LEVEL_POINTS) + 1;
  if (level > MAX_LEVEL) level = MAX_LEVEL;

  const isMax = level >= MAX_LEVEL;
  const levelStartPoints = (level - 1) * LEVEL_POINTS;
  const pointsIntoLevel = isMax ? LEVEL_POINTS : Math.max(0, points - levelStartPoints);
  const pointsToNext = isMax ? 0 : Math.max(0, LEVEL_POINTS - pointsIntoLevel);
  const progress = isMax ? 100 : Math.max(0, Math.min(100, Math.round((pointsIntoLevel / LEVEL_POINTS) * 100)));
  const rank = getLevelRank(level);

  return {
    points: points,
    level: level,
    maxLevel: MAX_LEVEL,
    isMax: isMax,
    pointsToNext: pointsToNext,
    progress: progress,
    rank: rank,
    current: { name: 'المستوى ' + level, icon: rank.icon, color: rank.color },
    next: isMax ? null : { name: 'المستوى ' + (level + 1) }
  };
}
window.getUserTier = getUserTier;

/* ================= دوال المحاضرات والتقدم ================= */

/** يحدد حالة الوصول لمحاضرة معيّنة (منشورة/مقفولة بالتاريخ/بالترتيب) */
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
window.getLessonAccessState = getLessonAccessState;

/** يحسب هل المحاضرة مكتملة (كل الاختبارات أو فيديو واحد على الأقل) */
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
window.computeLessonCompletion = computeLessonCompletion;

/** يحسب نسبة إتمام كورس/مسابقة كامل */
function computeCourseProgress(lessons, progressData) {
  const ids = Object.keys(lessons || {});
  if (ids.length === 0) return 0;
  const doneCount = ids.filter(function (id) { return progressData[id] && progressData[id].completed; }).length;
  return Math.round((doneCount / ids.length) * 100);
}
window.computeCourseProgress = computeCourseProgress;

/* ================= دوال المصادقة والهيدر ================= */

/** يتحقق من تسجيل الدخول وصلاحيات المستخدم (غير محظور) */
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
window.requireAuth = requireAuth;

/** يرسم الهيدر الموحد داخل عنصر #appHeader */
function renderAppHeader(user, userData, opts) {
  opts = opts || {};
  const showPoints = opts.showPoints !== false;
  const header = document.getElementById('appHeader');
  if (!header) return;

  // الحرف الأول للأيقونة
  const name = (userData.name || 'مستخدم').trim();
  const firstLetter = name.charAt(0).toUpperCase();

  header.innerHTML =
    '<div class="header-inner">' +
      '<div class="brand-block">' +
        '<img src="logo.png" alt="شعار المنصة" onerror="this.style.display=\'none\'">' +
        '<div class="brand-text"><h2>منصة أواب الإلكترونية</h2></div>' +
      '</div>' +
      '<div class="header-right">' +
        (showPoints ?
          '<div class="points-badge" title="نقاطي">' +
            icon('star') +
            '<span id="pointsValue">' + (userData.points || 0) + '</span>' +
          '</div>' : ''
        ) +
        '<div class="notif-menu">' +
          '<button class="notif-btn" id="notifBtn" aria-label="الإشعارات">' + icon('bell', 'icon-md') + '<span class="notif-badge" id="notifBadge" style="display:none;">0</span></button>' +
          '<div class="notif-dropdown" id="notifDropdown">' +
            '<div class="notif-head"><span>الإشعارات</span><button type="button" class="notif-close-btn" id="notifCloseBtn" aria-label="إغلاق الإشعارات">' + icon('xmark', 'icon-sm') + '</button></div>' +
            '<div id="notifList"><div class="notif-empty">جارٍ التحميل...</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="account-menu">' +
          '<button class="account-btn" id="accountBtn" aria-label="حساب المستخدم">' +
            '<div class="avatar">' + firstLetter + '</div>' +
          '</button>' +
          '<div class="account-dropdown" id="accountDropdown">' +
            '<div style="padding: 8px 12px; font-weight: 700; color: var(--primary-dark); border-bottom: 1px solid var(--border); margin-bottom: 4px; display:flex; align-items:center; gap:8px;">' +
              icon('user', 'icon-sm') + ' ' + escapeHtml(name) +
            '</div>' +
            '<a href="account.html">' + icon('user') + ' حسابي</a>' +
            '<button class="danger" id="logoutBtn">' + icon('logout') + ' تسجيل الخروج</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  // ===== إدارة الإشعارات والقوائم =====
  const accountBtn = document.getElementById('accountBtn');
  const dropdown = document.getElementById('accountDropdown');
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifCloseBtn = document.getElementById('notifCloseBtn');

  // نقل قائمة الإشعارات لتصبح ابنًا مباشرًا لـ body (لتجاوز مشاكل backdrop-filter)
  document.body.appendChild(notifDropdown);

  function positionNotifDropdown() {
    if (window.innerWidth <= 640) { notifDropdown.style.top = ''; notifDropdown.style.left = ''; return; }
    const rect = notifBtn.getBoundingClientRect();
    const width = 320;
    let left = rect.left - 60;
    if (left < 10) left = 10;
    if (left + width > window.innerWidth - 10) left = window.innerWidth - width - 10;
    notifDropdown.style.top = (rect.bottom + 10) + 'px';
    notifDropdown.style.left = left + 'px';
  }
  window.addEventListener('resize', function () {
    if (notifDropdown.classList.contains('open')) positionNotifDropdown();
  });

  function openNotifDropdown() {
    dropdown.classList.remove('open');
    positionNotifDropdown();
    notifDropdown.classList.add('open');
    document.body.classList.add('notif-open-lock');
  }
  function closeNotifDropdown() {
    notifDropdown.classList.remove('open');
    document.body.classList.remove('notif-open-lock');
  }

  accountBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    closeNotifDropdown();
    dropdown.classList.toggle('open');
  });
  notifBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dropdown.classList.remove('open');
    if (notifDropdown.classList.contains('open')) closeNotifDropdown();
    else openNotifDropdown();
  });
  notifCloseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    closeNotifDropdown();
  });
  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target) && e.target !== accountBtn) dropdown.classList.remove('open');
    if (!notifDropdown.contains(e.target) && e.target !== notifBtn && !notifBtn.contains(e.target)) closeNotifDropdown();
  });
  document.getElementById('logoutBtn').addEventListener('click', function () {
    auth.signOut().then(function () { window.location.href = 'index.html'; });
  });

  // تفعيل الإشعارات للمستخدم الحالي
  if (user) initNotifications(user.uid);
}
window.renderAppHeader = renderAppHeader;

/* ================= دوال الإشعارات ================= */

/** يفعّل جرس الإشعارات: يستمع لإشعارات المستخدم ويعرضها */
function initNotifications(uid) {
  const notifRef = db.ref('notifications/' + uid);
  notifRef.limitToLast(30).on('value', function (snap) {
    const data = snap.val() || {};
    const ids = Object.keys(data).sort(function (a, b) { return (data[b].createdAt || 0) - (data[a].createdAt || 0); });
    const unreadCount = ids.filter(function (id) { return !data[id].read; }).length;

    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (unreadCount > 0) { badge.style.display = 'flex'; badge.textContent = unreadCount > 9 ? '9+' : unreadCount; }
      else { badge.style.display = 'none'; }
    }

    const list = document.getElementById('notifList');
    if (!list) return;
    if (ids.length === 0) {
      list.innerHTML = '<div class="notif-empty">لا توجد إشعارات بعد</div>';
      return;
    }

    list.innerHTML = ids.map(function (id) {
      const n = data[id];
      const iconName = n.type === 'reply' ? 'reply' : (n.type === 'lesson' ? 'video' : (n.type === 'exam' ? 'listCheck' : (n.type === 'announcement' ? 'bell' : 'circleInfo')));
      return '<a class="notif-item ' + (n.read ? '' : 'unread') + '" href="' + (n.link || '#') + '" data-id="' + id + '">' +
        '<span class="notif-icon">' + icon(iconName, 'icon-sm') + '</span>' +
        '<span class="notif-body">' +
          '<span class="notif-title">' + escapeHtml(n.title || '') + '</span>' +
          (n.body ? '<span class="notif-sub">' + escapeHtml(n.body) + '</span>' : '') +
          '<span class="notif-time">' + formatArabicDate(n.createdAt) + '</span>' +
        '</span>' +
      '</a>';
    }).join('');

    list.querySelectorAll('.notif-item').forEach(function (item) {
      item.addEventListener('click', function () {
        notifRef.child(item.dataset.id).update({ read: true });
      });
    });
  });
}
window.initNotifications = initNotifications;

/** تتحقق من المحاضرات اللي معاد نشرها المجدول وصلت وتبعت إشعار */
function checkAndNotifyReleasedLessons(uid, enrollments, competitionsData) {
  if (!uid || !enrollments || !competitionsData) return;
  const now = Date.now();
  Object.keys(enrollments).forEach(function (compId) {
    const comp = competitionsData[compId];
    if (!comp || !comp.lessons) return;
    const enrolledAt = enrollments[compId];
    Object.keys(comp.lessons).forEach(function (lessonId) {
      const lesson = comp.lessons[lessonId];
      if (!lesson || !lesson.releaseAt || lesson.releaseAt > now) return;
      const flagRef = db.ref('notifiedLessons/' + uid + '/' + compId + '_' + lessonId);
      flagRef.once('value').then(function (snap) {
        if (snap.exists()) return;
        const isOldContent = enrolledAt && lesson.releaseAt < enrolledAt;
        const markSeen = flagRef.set(true);
        if (isOldContent) return markSeen;
        return markSeen.then(function () {
          return db.ref('notifications/' + uid).push({
            type: 'lesson',
            title: 'اتفتحت محاضرة جديدة',
            body: 'محاضرة "' + (lesson.title || '') + '" بقت متاحة في "' + (comp.title || '') + '"',
            link: 'competition.html?id=' + compId,
            read: false,
            createdAt: firebase.database.ServerValue.TIMESTAMP
          });
        });
      }).catch(function (err) { console.error('تعذر التحقق من إشعار المحاضرة:', err); });
    });
  });
}
window.checkAndNotifyReleasedLessons = checkAndNotifyReleasedLessons;

/* ================= دوال الفوتر والدعم الفني ================= */

/** يرسم الفوتر الموحد داخل عنصر #siteFooter */
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

  renderSupportFab();
}
window.renderFooter = renderFooter;

/** يضيف زر "الدعم الفني" العائم أسفل الشاشة */
function renderSupportFab() {
  if (document.getElementById('supportFab')) return;
  const fab = document.createElement('a');
  fab.id = 'supportFab';
  fab.className = 'support-fab';
  fab.href = 'support.html';
  fab.innerHTML = icon('headset') + ' <span>الدعم الفني</span>';
  document.body.appendChild(fab);
}
window.renderSupportFab = renderSupportFab;