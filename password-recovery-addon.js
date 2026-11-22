// ICMPSR password recovery add-on. Injected after the existing library source.
(function () {
  const RECOVERY_URL = 'https://icmpsr-center.github.io/ICMPSR-Knowledge-Library/?password-recovery=1';
  const $ = (id) => document.getElementById(id);
  function status(el, message, kind) {
    el.textContent = message;
    el.style.color = kind === 'error' ? '#b54747' : '#16835d';
  }
  function install() {
    if (typeof db === 'undefined' || !$('loginForm') || $('forgotPasswordBtn')) return;
    const loginForm = $('loginForm');
    const loginButton = loginForm.querySelector('button[type="submit"],button:not([type])');
    const forgot = document.createElement('button');
    forgot.id = 'forgotPasswordBtn';
    forgot.type = 'button';
    forgot.className = 'btn light';
    forgot.style.cssText = 'width:100%;margin-top:12px';
    forgot.textContent = 'نسيت كلمة المرور؟';
    const forgotStatus = document.createElement('div');
    forgotStatus.id = 'forgotPasswordStatus';
    forgotStatus.className = 'status';
    loginButton.insertAdjacentElement('afterend', forgot);
    forgot.insertAdjacentElement('afterend', forgotStatus);

    const recovery = document.createElement('section');
    recovery.id = 'passwordRecoveryBox';
    recovery.className = 'auth hidden';
    recovery.innerHTML = '<h2>تعيين كلمة مرور جديدة</h2><p class="muted">أدخل كلمة المرور الجديدة لحسابك ثم أكدها.</p><form id="newPasswordForm"><div class="field"><label>كلمة المرور الجديدة</label><input id="newPassword" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>تأكيد كلمة المرور</label><input id="confirmNewPassword" type="password" minlength="8" autocomplete="new-password" required></div><button class="btn" type="submit" style="width:100%">حفظ كلمة المرور الجديدة</button><div id="newPasswordStatus" class="status"></div></form>';
    $('authBox').insertAdjacentElement('afterend', recovery);

    forgot.addEventListener('click', async function () {
      const email = $('email').value.trim();
      if (!email) {
        status(forgotStatus, 'أدخل بريدك الإلكتروني أولًا ثم اضغط نسيت كلمة المرور.', 'error');
        $('email').focus();
        return;
      }
      forgot.disabled = true;
      status(forgotStatus, 'جارٍ إرسال رابط الاستعادة إلى بريدك...', 'info');
      try {
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: RECOVERY_URL });
        if (error) throw error;
        status(forgotStatus, 'إذا كان البريد مسجلًا، فستصلك رسالة استعادة. افتح الرابط من الجهاز نفسه.', 'success');
      } catch (error) {
        status(forgotStatus, 'تعذر إرسال رسالة الاستعادة: ' + (error.message || error), 'error');
      } finally {
        forgot.disabled = false;
      }
    });

    $('newPasswordForm').addEventListener('submit', async function (event) {
      event.preventDefault();
      const password = $('newPassword').value;
      const confirm = $('confirmNewPassword').value;
      if (password.length < 8) {
        status($('newPasswordStatus'), 'يجب ألا تقل كلمة المرور عن 8 أحرف.', 'error');
        return;
      }
      if (password !== confirm) {
        status($('newPasswordStatus'), 'كلمتا المرور غير متطابقتين.', 'error');
        return;
      }
      const submit = this.querySelector('button[type="submit"]');
      submit.disabled = true;
      status($('newPasswordStatus'), 'جارٍ تحديث كلمة المرور...', 'info');
      try {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        status($('newPasswordStatus'), 'تم تغيير كلمة المرور بنجاح. سيتم نقلك إلى تسجيل الدخول.', 'success');
        await db.auth.signOut();
        setTimeout(() => {
          const url = new URL(window.location.href);
          url.search = '';
          url.hash = '';
          window.location.replace(url.toString());
        }, 1400);
      } catch (error) {
        status($('newPasswordStatus'), 'تعذر تحديث كلمة المرور: ' + (error.message || error), 'error');
        submit.disabled = false;
      }
    });

    function showRecovery() {
      $('authBox').classList.add('hidden');
      const app = $('app');
      if (app) app.classList.add('hidden');
      recovery.classList.remove('hidden');
    }
    db.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') showRecovery();
    });
    if (new URLSearchParams(window.location.search).get('password-recovery') === '1') {
      db.auth.getSession().then(({ data }) => {
        if (data && data.session) showRecovery();
        else status(forgotStatus, 'رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رسالة جديدة.', 'error');
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
