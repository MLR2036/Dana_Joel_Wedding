// RSVP form: show/hide fields, check answers, send to the Google Apps Script, then thank the guest.

// Paste your Apps Script web app URL here (see README, step 3). It ends in /exec.
const RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzuc7USPPInGmaMOVrWf5tBe74Ln9EZTZs2T8OK1-YQ4l_l2ti9DqLAKRW0LyF-ZtOB/exec';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('rsvp-form');
  const thanks = document.getElementById('rsvp-thanks');
  const submit = document.getElementById('rsvp-submit');
  const formError = document.getElementById('form-error');
  const meal = document.getElementById('meal-group');
  const declineNote = document.getElementById('decline-note');
  const allergyBox = document.getElementById('has-allergy');
  const allergyPanel = document.getElementById('allergy-detail');
  const allergyText = document.getElementById('allergy');

  // Declining hides (and disables) the meal questions.
  form.querySelectorAll('input[name="attending"]').forEach((radio) =>
    radio.addEventListener('change', () => {
      const declining = form.attending.value === 'no';
      meal.hidden = declining;
      meal.disabled = declining;
      declineNote.hidden = !declining;
      hideError('attending');
    })
  );

  // Ticking the allergy box reveals the text field.
  allergyBox.addEventListener('change', () => {
    allergyPanel.hidden = !allergyBox.checked;
    allergyBox.setAttribute('aria-expanded', String(allergyBox.checked));
    if (allergyBox.checked) allergyText.focus();
    else hideError('allergy');
  });

  form.querySelectorAll('input[name="meal"]').forEach((r) => r.addEventListener('change', () => hideError('meal')));
  ['name', 'email', 'allergy'].forEach((id) =>
    document.getElementById(id).addEventListener('input', () => hideError(id))
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;

    const data = {
      name: document.getElementById('name').value.trim().replace(/\s+/g, ' '),
      email: document.getElementById('email').value.trim(),
      attending: form.attending.value,
      meal: '',
      allergy: '',
      website: document.getElementById('website').value, // honeypot
    };
    if (data.attending === 'yes') {
      data.meal = form.meal.value;
      if (allergyBox.checked) data.allergy = allergyText.value.trim();
    }

    // Check answers; focus the first problem.
    const problems = [];
    if (data.name.length < 2) problems.push('name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) problems.push('email');
    if (!data.attending) problems.push('attending');
    if (data.attending === 'yes' && !data.meal) problems.push('meal');
    if (data.attending === 'yes' && allergyBox.checked && !data.allergy) problems.push('allergy');
    if (problems.length) {
      problems.forEach(showError);
      focusField(problems[0]);
      return;
    }

    // A filled honeypot means a bot: pretend it worked, send nothing.
    if (data.website) {
      showThanks(data);
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Sending…';
    try {
      if (RSVP_ENDPOINT.startsWith('PASTE_')) throw new Error('The RSVP form is not connected yet (see README, step 3).');
      // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
      const res = await fetch(RSVP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.ok) throw new Error(result.error || 'Something went wrong.');
      showThanks(data);
    } catch (err) {
      console.error(err);
      formError.textContent = "Sorry, we couldn't send your reply. Please try again, or email us if it keeps happening.";
      formError.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Send reply';
    }
  });

  function showThanks(data) {
    const accepted = data.attending === 'yes';
    const first = data.name.split(' ')[0] || 'friend';
    document.getElementById('thanks-title').textContent = accepted ? `Thank you, ${first}!` : `Thank you, ${first}`;
    document.getElementById('thanks-body').textContent = accepted
      ? "We can't wait to celebrate with you. We've emailed you a confirmation. Here's how to get there and where to stay."
      : "We're sorry you can't make it, and we'll be thinking of you on the day. We've emailed you a confirmation.";
    document.getElementById('thanks-travel').hidden = !accepted;
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus({ preventScroll: true });
    thanks.scrollIntoView({ block: 'center' });
    if (accepted) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => document.getElementById('travel').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 1600);
    }
  }

  function showError(id) {
    document.getElementById(`${id}-error`).hidden = false;
    const field = document.getElementById(id);
    if (field) field.setAttribute('aria-invalid', 'true');
  }
  function hideError(id) {
    document.getElementById(`${id}-error`).hidden = true;
    const field = document.getElementById(id);
    if (field) field.removeAttribute('aria-invalid');
  }
  function focusField(id) {
    const el = document.getElementById(id) || form.querySelector(`input[name="${id}"]`);
    el.focus();
  }
});
