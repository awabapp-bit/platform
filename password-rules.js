/* قواعد التحقق من قوة كلمة المرور — مشتركة بين صفحة إنشاء الحساب وصفحة الحساب الشخصي */

function checkPasswordRules(password, confirm) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
    match: password.length > 0 && password === confirm
  };
}

function allRulesPass(rules) {
  return Object.values(rules).every(Boolean);
}

/* يربط عناصر <li data-rule="length|upper|lower|number|symbol|match"> داخل حاوية
   بحالة القواعد، ويضيف/يزيل كلاس ok مع علامة الصح */
function renderPasswordRules(container, rules) {
  Object.keys(rules).forEach(function (key) {
    const li = container.querySelector('[data-rule="' + key + '"]');
    if (!li) return;
    if (rules[key]) {
      li.classList.add('ok');
      li.querySelector('.tick').innerHTML = icon('check');
    } else {
      li.classList.remove('ok');
      li.querySelector('.tick').innerHTML = '';
    }
  });
}

/* التحقق من أن الاسم رباعي (أربع كلمات على الأقل، كل كلمة حرفان فأكثر) */
function isQuadName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 4 && parts.every(function (p) { return p.length >= 2; });
}
