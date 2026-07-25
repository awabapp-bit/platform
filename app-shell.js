/* قشرة التطبيق المشتركة لموقع المستخدم: التحقق من تسجيل الدخول، الهيدر، الإشعارات،
   الفوتر، زر الدعم العائم، نظام المستويات، قواعد فتح المحاضرات، واكتمال المحاضرة. */

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
 * يرسم الهيدر الموحد داخل عنصر #appHeader، بما فيه جرس الإشعارات.
 * user: كائن مستخدم Firebase (لازم لتفعيل الإشعارات)
 */
function renderAppHeader(user, userData, opts) {
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
          '<h2>منصة أواب الإلكترونية</h2>' +
        '</div>' +
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
            '<div class="notif-head"><span>الإشعارات</span></div>' +
            '<div id="notifList"><div class="notif-empty">جارٍ التحميل...</div></div>' +
          '</div>' +
        '</div>' +
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
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');

  accountBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    notifDropdown.classList.remove('open');
    dropdown.classList.toggle('open');
  });
  notifBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dropdown.classList.remove('open');
    notifDropdown.classList.toggle('open');
  });
  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target) && e.target !== accountBtn) dropdown.classList.remove('open');
    if (!notifDropdown.contains(e.target) && e.target !== notifBtn && !notifBtn.contains(e.target)) notifDropdown.classList.remove('open');
  });
  document.getElementById('logoutBtn').addEventListener('click', function () {
    auth.signOut().then(function () { window.location.href = 'index.html'; });
  });

  if (user) initNotifications(user.uid);
}

/**
 * تتحقق من المحاضرات اللي معاد نشرها المجدول وصل ولسه المستخدم ماوصلوش إشعار عليها،
 * وبترسل له إشعار "محاضرة جديدة" وتسجّل إنه اتبعتله عشان محايجيلوش تاني.
 * لازم تتنادى بعد ما enrollments و competitionsData يتحمّلوا.
 * سبب وجودها: الموقع static بدون سيرفر/cron، فمفيش حاجة بتشتغل تلقائيًا وقت معاد النشر
 * نفسه؛ فبنتحقق وقت ما الطالب بيفتح الموقع بدل ما ننتظر سيرفر مش موجود.
 */
function checkAndNotifyReleasedLessons(uid, enrollments, competitionsData) {
  if (!uid || !enrollments || !competitionsData) return;
  const now = Date.now();
  Object.keys(enrollments).forEach(function (compId) {
    const comp = competitionsData[compId];
    if (!comp || !comp.lessons) return;
    const enrolledAt = enrollments[compId]; // وقت اشتراك الطالب في هذا الكورس
    Object.keys(comp.lessons).forEach(function (lessonId) {
      const lesson = comp.lessons[lessonId];
      if (!lesson || !lesson.releaseAt || lesson.releaseAt > now) return;
      const flagRef = db.ref('notifiedLessons/' + uid + '/' + compId + '_' + lessonId);
      flagRef.once('value').then(function (snap) {
        if (snap.exists()) return;
        // لو المحاضرة كانت متاحة بالفعل قبل ما الطالب يشترك، منبعتلوش إشعار (تفادي إغراقه
        // بإشعارات عن محتوى قديم)، بس بنسجّلها كمشوفة عشان محانتحققش منها تاني
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

/**
 * يرسم الفوتر الموحد داخل عنصر #siteFooter، ويضيف زر الدعم الفني العائم تلقائيًا
 */
function renderFooter() {
  const footer = document.getElementById('siteFooter');
  if (footer) {
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
  renderSupportFab();
}

/** يضيف زر "الدعم الفني" العائم أسفل الشاشة (رابط فارغ حاليًا لحين تجهيز صفحة الدعم) */
function renderSupportFab() {
  if (document.getElementById('supportFab')) return;
  const fab = document.createElement('a');
  fab.id = 'supportFab';
  fab.className = 'support-fab';
  fab.href = '#';
  fab.innerHTML = icon('headset') + ' <span>الدعم الفني</span>';
  document.body.appendChild(fab);
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

/* ================= نظام المستويات (1000 مستوى، كل مستوى 100 نقطة) ================= */
const LEVEL_POINTS = 100;   // النقاط المطلوبة لكل مستوى
const MAX_LEVEL = 1000;     // أعلى مستوى ممكن

/* رتب مظهرية (لون وأيقونة فقط) تتوزع على مدى الـ 1000 مستوى */
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

/**
 * يحدد مستوى المستخدم الحالي بناءً على نقاطه (كل 100 نقطة = مستوى)، من أصل 1000 مستوى،
 * ونسبة تقدّمه للمستوى التالي. يُرجع كائنًا فيه كل ما تحتاجه واجهات العرض.
 */
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
    /* للتوافق مع أي كود قديم يقرأ current/next */
    current: { name: 'المستوى ' + level, icon: rank.icon, color: rank.color },
    next: isMax ? null : { name: 'المستوى ' + (level + 1) }
  };
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

/** يحسب نسبة إتمام مسابقة/كورس كامل (كل محاضراته) لمستخدم معيّن */
function computeCourseProgress(lessons, progressData) {
  const ids = Object.keys(lessons || {});
  if (ids.length === 0) return 0;
  const doneCount = ids.filter(function (id) { return progressData[id] && progressData[id].completed; }).length;
  return Math.round((doneCount / ids.length) * 100);
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
