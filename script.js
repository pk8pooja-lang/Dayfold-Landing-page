/* =========================================================
   Dayfold: page behaviour
   1. Theme (light / dark)
   2. Mobile menu
   3. Study planner demo
   4. Pricing toggle
   5. Waitlist form + success popup
   ========================================================= */
(function () {
  'use strict';

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- 1. Theme ---------- */
  var themeBtn = $('#theme-toggle');
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || (darkQuery.matches ? 'dark' : 'light');
  }

  function syncThemeLabel() {
    themeBtn.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('dayfold-theme', next); } catch (e) {}
    syncThemeLabel();
  });
  syncThemeLabel();

  /* ---------- 2. Mobile menu ---------- */
  var menuBtn = $('.menu-btn');
  var nav = $('#site-nav');

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
  }

  menuBtn.addEventListener('click', function () {
    setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  /* ---------- 3. Study planner demo ---------- */
  var BREAK_MINS = 10;
  var PRIORITY_LABEL = { 3: 'High priority', 2: 'Medium priority', 1: 'Low priority' };

  var tasks = [];
  var nextId = 1;

  var taskForm = $('#task-form');
  var nameInput = $('#task-name');
  var dueInput = $('#task-due');
  var minsInput = $('#task-mins');
  var prioInput = $('#task-prio');
  var taskError = $('#task-error');
  var taskList = $('#task-list');
  var taskEmpty = $('#task-empty');
  var startInput = $('#start-time');
  var hoursInput = $('#hours');
  var planOutput = $('#plan-output');

  function toInputDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function startOfToday() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  // Number of whole days from today until the date (negative = overdue), or null if no date
  function daysUntil(value) {
    if (!value) return null;
    var p = value.split('-');
    var due = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return Math.round((due - startOfToday()) / 86400000);
  }

  function dueLabel(days) {
    if (days === null) return 'No due date';
    if (days < 0) return 'Overdue by ' + Math.abs(days) + (Math.abs(days) === 1 ? ' day' : ' days');
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return 'Due in ' + days + ' days';
  }

  // Closer deadline = higher urgency
  function urgency(days) {
    if (days === null) return 0;
    if (days < 0) return 6;
    if (days === 0) return 5;
    if (days === 1) return 4;
    if (days <= 3) return 3;
    if (days <= 7) return 2;
    return 1;
  }

  function formatTime(totalMins) {
    var m = ((totalMins % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60);
    var min = m % 60;
    var suffix = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + pad(min) + ' ' + suffix;
  }

  function formatDuration(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h && m) return h + ' h ' + m + ' min';
    if (h) return h + ' h';
    return m + ' min';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text; // textContent keeps user input safe
    return node;
  }

  function renderTasks() {
    clear(taskList);
    taskEmpty.hidden = tasks.length > 0;

    tasks.forEach(function (t) {
      var li = el('li', 'task-item');
      var info = el('div', 'task-info');
      info.appendChild(el('p', 'task-name', t.name));
      info.appendChild(el('p', 'task-meta', dueLabel(daysUntil(t.due)) + ', ' + formatDuration(t.mins) + ', ' + PRIORITY_LABEL[t.prio].toLowerCase()));

      var remove = el('button', 'remove-btn', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + t.name);
      remove.addEventListener('click', function () {
        tasks = tasks.filter(function (x) { return x.id !== t.id; });
        renderTasks();
      });

      li.appendChild(info);
      li.appendChild(remove);
      taskList.appendChild(li);
    });
  }

  function showTaskError(message) {
    taskError.textContent = message;
  }

  taskForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameInput.value.trim();
    var mins = parseInt(minsInput.value, 10);

    if (!name) {
      showTaskError('Enter a task name, for example "Physics assignment".');
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.focus();
      return;
    }
    if (!(mins >= 5 && mins <= 480)) {
      showTaskError('Enter the time needed as a number between 5 and 480 minutes.');
      minsInput.setAttribute('aria-invalid', 'true');
      minsInput.focus();
      return;
    }

    nameInput.removeAttribute('aria-invalid');
    minsInput.removeAttribute('aria-invalid');
    showTaskError('');

    tasks.push({ id: nextId++, name: name, due: dueInput.value, mins: mins, prio: Number(prioInput.value) });
    renderTasks();

    nameInput.value = '';
    nameInput.focus();
  });

  // Clear the red error state as soon as the person starts fixing the field
  [nameInput, minsInput].forEach(function (input) {
    input.addEventListener('input', function () {
      input.removeAttribute('aria-invalid');
      showTaskError('');
    });
  });

  $('#sample-btn').addEventListener('click', function () {
    nameInput.removeAttribute('aria-invalid');
    minsInput.removeAttribute('aria-invalid');
    var base = startOfToday();
    function inDays(n) {
      var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
      return toInputDate(d);
    }
    var samples = [
      { name: 'Chemistry lab report', due: inDays(1), mins: 60, prio: 3 },
      { name: 'Read history chapter 6', due: inDays(3), mins: 40, prio: 2 },
      { name: 'Maths problem set', due: inDays(0), mins: 50, prio: 3 },
      { name: 'Essay outline', due: inDays(5), mins: 45, prio: 2 },
      { name: 'Tidy lecture notes', due: '', mins: 20, prio: 1 }
    ];
    samples.forEach(function (s) {
      tasks.push({ id: nextId++, name: s.name, due: s.due, mins: s.mins, prio: s.prio });
    });
    showTaskError('');
    renderTasks();
  });

  $('#clear-btn').addEventListener('click', function () {
    tasks = [];
    renderTasks();
    clear(planOutput);
    planOutput.appendChild(el('p', 'empty-note', 'Your plan will appear here. Add a few tasks, then press "Plan my day".'));
  });

  function showPlanMessage(text, isError) {
    clear(planOutput);
    planOutput.appendChild(el('p', isError ? 'plan-error' : 'empty-note', text));
  }

  function buildPlan() {
    var startValue = startInput.value;
    var hours = parseFloat(hoursInput.value);

    if (!startValue) return { error: 'Choose the time you start studying.' };
    if (!(hours >= 0.5 && hours <= 12)) return { error: 'Enter the hours you have today, between 0.5 and 12.' };
    if (tasks.length === 0) return { error: 'Add at least one task first.' };

    var parts = startValue.split(':');
    var start = Number(parts[0]) * 60 + Number(parts[1]);
    var available = Math.round(hours * 60);

    var scored = tasks.map(function (t) {
      var d = daysUntil(t.due);
      return { task: t, days: d, score: urgency(d) * 2 + t.prio };
    });

    // Highest score first; for equal scores, the shorter task goes first
    scored.sort(function (a, b) {
      return (b.score - a.score) || (a.task.mins - b.task.mins);
    });

    var used = 0;
    var planned = [];
    var later = [];

    scored.forEach(function (item) {
      if (used + item.task.mins <= available) {
        planned.push({ item: item, start: start + used, end: start + used + item.task.mins });
        used += item.task.mins + BREAK_MINS;
      } else {
        later.push(item);
      }
    });

    return { planned: planned, later: later };
  }

  $('#plan-btn').addEventListener('click', function () {
    var result = buildPlan();
    if (result.error) {
      showPlanMessage(result.error, true);
      return;
    }

    clear(planOutput);

    var focusMins = result.planned.reduce(function (sum, p) { return sum + p.item.task.mins; }, 0);

    if (result.planned.length === 0) {
      showPlanMessage('None of your tasks fit in that time. Try more hours, or shorten a task.', true);
      return;
    }

    planOutput.appendChild(el('p', 'plan-summary',
      result.planned.length + (result.planned.length === 1 ? ' task' : ' tasks') + ' planned, ' +
      formatDuration(focusMins) + ' of focus time.' +
      (result.later.length ? ' ' + result.later.length + ' moved to tomorrow.' : '')));

    var list = el('ol', 'plan');
    var index = 0;

    result.planned.forEach(function (p, i) {
      var t = p.item.task;
      var li = el('li', 'plan-item');
      li.style.setProperty('--i', String(index++));
      li.appendChild(el('p', 'plan-time', formatTime(p.start) + ' to ' + formatTime(p.end)));

      var name = el('p', 'plan-name');
      name.appendChild(el('span', 'mark', t.name));
      li.appendChild(name);

      li.appendChild(el('p', 'plan-meta', dueLabel(p.item.days) + ', ' + formatDuration(t.mins) + ', ' + PRIORITY_LABEL[t.prio].toLowerCase()));
      list.appendChild(li);

      if (i < result.planned.length - 1) {
        var gap = el('li', 'plan-break', BREAK_MINS + '-minute break');
        gap.style.setProperty('--i', String(index++));
        list.appendChild(gap);
      }
    });
    planOutput.appendChild(list);

    if (result.later.length) {
      var later = el('div', 'plan-later');
      later.appendChild(el('h4', '', 'Moves to tomorrow'));
      var ul = el('ul', 'later-list');
      result.later.forEach(function (item) {
        ul.appendChild(el('li', '', item.task.name + ' (' + formatDuration(item.task.mins) + ')'));
      });
      later.appendChild(ul);
      planOutput.appendChild(later);
    }
  });

  renderTasks();

  // Today's date as the earliest sensible due date
  dueInput.min = toInputDate(startOfToday());

  /* ---------- 4. Pricing toggle ---------- */
  var billingSwitch = $('#billing-switch');
  var lblMonthly = $('#lbl-monthly');
  var lblYearly = $('#lbl-yearly');

  billingSwitch.addEventListener('click', function () {
    var yearly = billingSwitch.getAttribute('aria-checked') !== 'true';
    billingSwitch.setAttribute('aria-checked', String(yearly));
    lblMonthly.classList.toggle('is-active', !yearly);
    lblYearly.classList.toggle('is-active', yearly);

    $$('[data-monthly]').forEach(function (node) {
      node.textContent = node.getAttribute(yearly ? 'data-yearly' : 'data-monthly');
    });
  });

  /* ---------- 5. Waitlist form + success popup ---------- */
  var wlForm = $('#waitlist-form');
  var wlName = $('#wl-name');
  var wlEmail = $('#wl-email');
  var wlLevel = $('#wl-level');
  var dialog = $('#success-dialog');
  var dialogText = $('#dialog-text');

  function setFieldError(input, message) {
    var box = $('#' + input.id + '-error');
    box.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  [wlName, wlEmail].forEach(function (input) {
    input.addEventListener('input', function () { setFieldError(input, ''); });
  });

  wlForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = wlName.value.trim();
    var email = wlEmail.value.trim();
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    var firstBad = null;

    if (name.length < 2) {
      setFieldError(wlName, 'Enter your name, at least 2 letters.');
      firstBad = firstBad || wlName;
    } else {
      setFieldError(wlName, '');
    }

    if (!emailOk) {
      setFieldError(wlEmail, 'Enter an email address like name@example.com.');
      firstBad = firstBad || wlEmail;
    } else {
      setFieldError(wlEmail, '');
    }

    if (firstBad) {
      firstBad.focus();
      return;
    }

    dialogText.textContent = 'Thanks, ' + name + '. We will email ' + email + ' once, when Dayfold opens for ' + wlLevel.value.toLowerCase() + ' students.';

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    wlForm.reset();
  });

  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  $('#dialog-close').addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDialog(); // click on the dimmed backdrop
  });
})();