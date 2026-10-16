/* K3 theme behaviour: theme toggle, "On this page" TOC with scroll-spy, prev/next cards. */
require(["gitbook"], function (gitbook) {
  var KEY = "k3-docs-theme";
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function apply(mode) { document.documentElement.setAttribute("data-theme", mode); }
  apply(stored() || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  function scroller() { return document.querySelector(".book-body .body-inner"); }

  var ICON_SEARCH = '<svg class="k3-ico" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  var modal, mInput, mList, mItems = [], mActive = -1, lastQuery = "";

  function escapeHtml(t) { return t.replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function plain(html) { var d = document.createElement("div"); d.innerHTML = html || ""; return (d.textContent || "").replace(/\s+/g, " ").trim(); }
  function snippet(body, q) {
    var text = plain(body), terms = q.toLowerCase().split(/\s+/).filter(Boolean), at = 0;
    for (var n = 0; n < terms.length; n++) { var f = text.toLowerCase().indexOf(terms[n]); if (f >= 0) { at = f; break; } }
    var start = Math.max(0, at - 50), out = escapeHtml(text.substr(start, 170));
    terms.forEach(function (t) { out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>"); });
    return (start > 0 ? "…" : "") + out + (start + 170 < text.length ? "…" : "");
  }

  function setActive(n) {
    mActive = n;
    mItems.forEach(function (el, i) { el.classList.toggle("active", i === n); });
    if (mItems[n]) mItems[n].scrollIntoView({ block: "nearest" });
  }
  function message(html) { mItems = []; mActive = -1; mList.innerHTML = '<div class="k3-s-msg">' + html + "</div>"; }

  function runSearch(q) {
    lastQuery = q;
    if (!q.trim()) { message("Type to search the documentation"); return; }
    if (!gitbook.search || !gitbook.search.isInitialized()) { message("Search is loading…"); return; }
    gitbook.search.query(q, 0, 12).then(function (res) {
      if (mInput.value !== q) return;
      if (!res.count) { message("No results for “" + escapeHtml(q) + "”"); return; }
      mList.innerHTML = ""; mItems = [];
      res.results.forEach(function (r) {
        var a = document.createElement("a"); a.className = "k3-s-item";
        a.href = gitbook.state.basePath + "/" + r.url;
        a.innerHTML = "<strong>" + escapeHtml(r.title) + "</strong><span>" + snippet(r.body, q) + "</span>";
        a.addEventListener("mousemove", function () { setActive(mItems.indexOf(a)); });
        mList.appendChild(a); mItems.push(a);
      });
      setActive(0);
    });
  }

  function buildModal() {
    if (modal) return;
    modal = document.createElement("div"); modal.className = "k3-modal"; modal.hidden = true;
    modal.innerHTML = '<div class="k3-modal-panel" role="dialog" aria-modal="true" aria-label="Search documentation">' +
      '<div class="k3-modal-field">' + ICON_SEARCH + '<input type="text" autocomplete="off" spellcheck="false" placeholder="Search the documentation…" aria-label="Search"><kbd>esc</kbd></div>' +
      '<div class="k3-modal-list"></div></div>';
    document.body.appendChild(modal);
    mInput = modal.querySelector("input"); mList = modal.querySelector(".k3-modal-list");
    modal.addEventListener("mousedown", function (e) { if (e.target === modal) closeSearch(); });
    mInput.addEventListener("input", function () { runSearch(mInput.value); });
    mInput.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); if (mItems.length) setActive((mActive + 1) % mItems.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (mItems.length) setActive((mActive - 1 + mItems.length) % mItems.length); }
      else if (e.key === "Enter") { if (mItems[mActive]) { e.preventDefault(); window.location.href = mItems[mActive].href; } }
      else if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
    });
    gitbook.events.bind("search.ready", function () { if (modal && !modal.hidden && lastQuery) runSearch(lastQuery); });
  }
  function openSearch() { buildModal(); var sc = scroller(); if (sc) document.documentElement.style.setProperty("--k3-sbw", (sc.offsetWidth - sc.clientWidth) + "px"); modal.hidden = false; document.documentElement.classList.add("k3-modal-open"); mInput.focus(); mInput.select(); runSearch(mInput.value); }
  function closeSearch() { if (!modal) return; modal.hidden = true; document.documentElement.classList.remove("k3-modal-open"); }
  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName || "").toLowerCase(), typing = tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); modal && !modal.hidden ? closeSearch() : openSearch(); }
    else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openSearch(); }
    else if (e.key === "Escape" && modal && !modal.hidden) closeSearch();
  });

  function buildTopbar() {
    if (document.querySelector(".k3-topbar")) return;
    var bar = document.createElement("header"); bar.className = "k3-topbar";
    var left = document.createElement("div"); left.className = "k3-left";
    var menu = document.createElement("button"); menu.className = "k3-icon-btn k3-menu"; menu.setAttribute("aria-label", "Toggle navigation"); menu.textContent = "☰";
    menu.addEventListener("click", function () { setSidebar(!sidebarOpen()); });
    var logo = document.createElement("a"); logo.className = "k3-logo"; logo.setAttribute("aria-label", "Home");
    logo.addEventListener("click", function () { var f = document.querySelector(".book-summary ul.summary a"); if (f) f.click(); });
    left.appendChild(menu); left.appendChild(logo);
    var switcher = buildSwitcher(); if (switcher) left.appendChild(switcher);

    var search = document.createElement("div"); search.className = "k3-search";
    var trigger = document.createElement("button"); trigger.type = "button"; trigger.className = "k3-search-trigger";
    trigger.innerHTML = ICON_SEARCH + "<span>Search…</span><kbd>" + (/Mac/.test(navigator.platform) ? "⌘K" : "Ctrl K") + "</kbd>";
    trigger.addEventListener("click", openSearch);
    search.appendChild(trigger);

    var right = document.createElement("div"); right.className = "k3-right";
    var gh = document.querySelector('.book-summary a[href*="github.com"]:not(.gitbook-link)');
    if (gh) { var g = document.createElement("a"); g.className = "k3-gh"; g.href = gh.href; g.target = "_blank"; g.rel = "noopener"; g.innerHTML = "<span>GitHub</span> ↗"; right.appendChild(g); }
    var t = document.createElement("button"); t.className = "k3-icon-btn"; t.setAttribute("aria-label", "Toggle light/dark theme"); t.title = "Toggle theme";
    var SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    var SUN = SVG + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    var MOON = SVG + '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    /* shows the icon of the theme you will switch TO */
    function paint() { t.innerHTML = document.documentElement.getAttribute("data-theme") === "dark" ? SUN : MOON; }
    t.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(next); try { localStorage.setItem(KEY, next); } catch (e) {} paint();
    });
    paint(); right.appendChild(t);

    bar.appendChild(left); bar.appendChild(search); bar.appendChild(right);
    document.querySelector(".book").appendChild(bar);
  }

  /* Scroll-spy state. HonKit replaces the scroll container (.book-body .body-inner) on every page change, so nothing
     here may hold on to a specific element: the container is looked up on each update and scroll events are caught
     at document level (capture phase). */
  var tocHeads = [], tocItems = [], tocForced = null, tocForcedAt = 0;
  function setActive(i) { tocItems.forEach(function (li, n) { li.classList.toggle("active", n === i); }); }
  function updateSpy() {
    var sc = scroller(); if (!sc || !tocHeads.length) return;
    /* A clicked entry stays selected: the last sections are often too short to ever reach the top of the screen. */
    if (tocForced !== null) {
      var fr = tocHeads[tocForced].getBoundingClientRect(), sr = sc.getBoundingClientRect();
      /* keep it while the smooth scroll is running, then only while that section is still on screen
         (covers scrollbar drags and any other input that doesn't fire wheel/touch/key events) */
      if (performance.now() - tocForcedAt < 1500 || (fr.bottom > sr.top && fr.top < sr.bottom)) { setActive(tocForced); return; }
      tocForced = null;
    }
    var top = sc.getBoundingClientRect().top + 40, cur = 0;
    tocHeads.forEach(function (h, i) { if (h.getBoundingClientRect().top <= top) cur = i; });
    /* Scrolled to the very end: the last section is the one being read, even though its heading can't reach the top. */
    var scrollable = sc.scrollHeight > sc.clientHeight + 4;
    if (scrollable && sc.scrollTop > 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) cur = tocHeads.length - 1;
    setActive(cur);
  }
  document.addEventListener("scroll", function (e) {
    var t = e.target; if (t && t.classList && t.classList.contains("body-inner")) updateSpy();
  }, true);
  window.addEventListener("resize", updateSpy);
  /* Any scrolling the reader does themselves hands control back to the scroll-spy. */
  function release() { if (tocForced !== null) { tocForced = null; updateSpy(); } }
  ["wheel", "touchmove"].forEach(function (ev) { document.addEventListener(ev, release, { passive: true }); });
  document.addEventListener("keydown", function (e) {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].indexOf(e.key) >= 0) release();
  });

  function buildToc() {
    var old = document.querySelector(".k3-toc"); if (old) old.remove();
    tocHeads = []; tocItems = []; tocForced = null;
    var section = document.querySelector(".markdown-section"); if (!section) return;
    var heads = [].slice.call(section.querySelectorAll("h2[id], h3[id]"));
    if (heads.length < 2) return;
    var toc = document.createElement("nav"); toc.className = "k3-toc"; toc.setAttribute("aria-label", "On this page");
    var html = "<h4>On this page</h4><ul>";
    heads.forEach(function (h) {
      html += '<li class="' + h.tagName.toLowerCase().replace("h", "l") + '"><a href="#' + h.id + '"></a></li>';
    });
    toc.innerHTML = html + "</ul>";
    [].forEach.call(toc.querySelectorAll("a"), function (a, i) {
      a.textContent = heads[i].textContent;
      a.addEventListener("click", function (e) { e.preventDefault(); tocForced = i; tocForcedAt = performance.now(); setActive(i); heads[i].scrollIntoView({ behavior: "smooth", block: "start" }); });
    });
    document.querySelector(".book-body").appendChild(toc);
    tocHeads = heads; tocItems = [].slice.call(toc.querySelectorAll("li"));
    /* the new page may still be laid out / scrolled to its start position a moment after the page-change event */
    updateSpy();
    requestAnimationFrame(updateSpy);
    setTimeout(updateSpy, 120);
    setTimeout(updateSpy, 400);
  }

  function buildPager() {
    var section = document.querySelector(".markdown-section"); if (!section) return;
    var old = section.querySelector(".k3-pager"); if (old) old.remove();
    var prev = document.querySelector("a.navigation-prev"), next = document.querySelector("a.navigation-next");
    if (!prev && !next) return;
    var wrap = document.createElement("div"); wrap.className = "k3-pager";
    function card(a, cls, label) {
      var title = (a.getAttribute("aria-label") || "").replace(/^(Previous|Next) page:\s*/, "");
      var el = document.createElement("a"); el.className = cls; el.href = a.getAttribute("href");
      var s = document.createElement("small"); s.textContent = label; var t = document.createElement("span"); t.textContent = title;
      el.appendChild(s); el.appendChild(t); wrap.appendChild(el);
    }
    if (prev) card(prev, "prev", "← Previous");
    if (next) card(next, "next", "Next →");
    section.appendChild(wrap);
  }

  /* Lock the sidebar when it overflows by only a few pixels: a scroll that barely moves is worse than none. */
  function fitNav() {
    var nav = document.querySelector(".book-summary"); if (!nav) return;
    nav.style.overflowY = "auto";
    nav.style.overflowY = nav.scrollHeight - nav.clientHeight <= 24 ? "hidden" : "auto";
  }
  window.addEventListener("resize", fitNav);

  /* A "## Title" line in SUMMARY.md renders as a non-clickable section title (li.header). The plain pages that follow it
     (up to the next title or group) are indented under it, like the groups in the other docs set. */
  function markSectionTitles() {
    [].forEach.call(document.querySelectorAll(".book-summary ul.summary li.header"), function (h) {
      for (var n = h.nextElementSibling; n; n = n.nextElementSibling) {
        if (n.classList.contains("header") || n.classList.contains("divider") || n.querySelector(":scope > ul.articles")) break;
        if (n.classList.contains("chapter")) n.classList.add("k3-under-header");
      }
    });
  }

  /* Page header like modern docs: small section label above the title, short intro line below it. */
  function buildHeader() {
    var section = document.querySelector(".markdown-section"); if (!section) return;
    var oldEyebrow = section.querySelector(".k3-eyebrow"); if (oldEyebrow) oldEyebrow.remove();
    var h1 = section.querySelector("h1"); if (!h1) return;
    var lead = section.querySelector("p.k3-lead"); if (lead) lead.classList.remove("k3-lead");
    var next = h1.nextElementSibling;
    if (next && next.tagName === "P" && !next.querySelector("img") && next.textContent.trim().length <= 240) next.classList.add("k3-lead");
    var active = document.querySelector(".book-summary li.active");
    var group = active && active.parentElement && active.parentElement.closest("li.chapter");
    var label = group && group !== active && group.querySelector(":scope > a, :scope > span");
    if (!label && active && active.classList.contains("k3-under-header")) {          // page listed under a section title
      for (var h = active.previousElementSibling; h; h = h.previousElementSibling) if (h.classList.contains("header")) { label = h; break; }
    }
    if (label) {
      var e = document.createElement("div"); e.className = "k3-eyebrow"; e.textContent = label.textContent.trim();
      section.insertBefore(e, h1);
    }
  }

  /* ---- responsive helpers ---- */
  var narrowMQ = window.matchMedia("(max-width: 999px)");
  function bookEl() { return document.querySelector(".book"); }
  function sidebarOpen() { return bookEl().classList.contains("with-summary"); }
  function setSidebar(open) { bookEl().classList.toggle("with-summary", open); }
  /* Pinned open on desktop, closed drawer on narrow screens. HonKit remembers the last state in localStorage,
     which could leave a desktop reader without a sidebar (or a phone with the drawer covering the page). */
  function syncSidebar(first) {
    var book = bookEl(); if (!book) return;
    var want = !narrowMQ.matches;
    if (first) book.classList.add("k3-init");
    if (sidebarOpen() !== want) setSidebar(want);
    if (first) requestAnimationFrame(function () { requestAnimationFrame(function () { book.classList.remove("k3-init"); }); });
  }
  function buildBackdrop() {
    if (document.querySelector(".k3-backdrop")) return;
    var d = document.createElement("div"); d.className = "k3-backdrop";
    d.addEventListener("click", function () { setSidebar(false); });
    bookEl().appendChild(d);
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && narrowMQ.matches && bookEl() && sidebarOpen() && !(modal && !modal.hidden)) setSidebar(false);
  });
  var mqHandler = function () { syncSidebar(false); };
  if (narrowMQ.addEventListener) narrowMQ.addEventListener("change", mqHandler); else if (narrowMQ.addListener) narrowMQ.addListener(mqHandler);

  /* Tables scroll inside their own container */
  function wrapTables() {
    [].forEach.call(document.querySelectorAll(".markdown-section table"), function (t) {
      if (t.parentElement && t.parentElement.classList.contains("k3-table-wrap")) return;
      var w = document.createElement("div"); w.className = "k3-table-wrap"; t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
  }

  /* "On this page" for widths where the right-hand panel does not fit */
  function buildInlineToc() {
    var section = document.querySelector(".markdown-section"); if (!section) return;
    var old = section.querySelector(".k3-toc-inline"); if (old) old.remove();
    var heads = [].slice.call(section.querySelectorAll("h2[id], h3[id]")); if (heads.length < 3) return;
    var d = document.createElement("details"); d.className = "k3-toc-inline";
    var sum = document.createElement("summary"); sum.textContent = "On this page"; d.appendChild(sum);
    var ul = document.createElement("ul");
    heads.forEach(function (h) {
      var li = document.createElement("li"); li.className = h.tagName.toLowerCase().replace("h", "l");
      var a = document.createElement("a"); a.href = "#" + h.id; a.textContent = h.textContent;
      a.addEventListener("click", function (e) { e.preventDefault(); d.open = false; h.scrollIntoView({ behavior: "smooth", block: "start" }); });
      li.appendChild(a); ul.appendChild(li);
    });
    d.appendChild(ul);
    var anchor = section.querySelector("p.k3-lead") || section.querySelector("h1");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(d, anchor.nextSibling);
  }

  /* ---- docs switcher: moves between the documentation sets published on the same site ---- */
  var DOC_SETS = [
    { key: "vault-infra", label: "Vault infra", desc: "Architecture, integration guide and reference" },
    { key: "sBOLT", label: "sBOLD", desc: "Liquity v2 Stability Pool wrapper" }
  ];
  function detectDocSet() {
    var parts = location.pathname.split("/");
    for (var i = 0; i < parts.length; i++)
      for (var k = 0; k < DOC_SETS.length; k++)
        if (parts[i] === DOC_SETS[k].key) return { current: DOC_SETS[k].key, base: parts.slice(0, i).join("/") + "/" };
    return null;                                   // not served from the combined site: nothing to switch to
  }
  var CHEVRON = '<svg class="k3-sw-chev" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  function buildSwitcher() {
    var where = detectDocSet(); if (!where) return null;
    var cur = DOC_SETS.filter(function (d) { return d.key === where.current; })[0];
    var wrap = document.createElement("div"); wrap.className = "k3-switch";
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "k3-switch-btn";
    btn.setAttribute("aria-haspopup", "menu"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", "Switch documentation: currently " + cur.label);
    btn.innerHTML = '<span class="k3-sw-label"></span>' + CHEVRON; btn.querySelector(".k3-sw-label").textContent = cur.label;
    var menu = document.createElement("div"); menu.className = "k3-switch-menu"; menu.setAttribute("role", "menu"); menu.hidden = true;
    DOC_SETS.forEach(function (d) {
      var a = document.createElement("a"); a.className = "k3-switch-item" + (d.key === where.current ? " current" : ""); a.setAttribute("role", "menuitem");
      a.href = where.base + d.key + "/"; if (d.key === where.current) a.setAttribute("aria-current", "true");
      a.innerHTML = '<span class="k3-si-text"><strong></strong><small></small></span><svg class="k3-si-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
      a.querySelector("strong").textContent = d.label; a.querySelector("small").textContent = d.desc;
      menu.appendChild(a);
    });
    function items() { return [].slice.call(menu.querySelectorAll(".k3-switch-item")); }
    function open() { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); wrap.classList.add("open"); }
    function close(focusBtn) { if (menu.hidden) return; menu.hidden = true; btn.setAttribute("aria-expanded", "false"); wrap.classList.remove("open"); if (focusBtn) btn.focus(); }
    /* keyboard users land on the current item; with a mouse, focus stays on the button (no focus ring on the first item) */
    btn.addEventListener("click", function (e) {
      if (!menu.hidden) { close(); return; }
      open(); if (e.detail === 0) (menu.querySelector(".current") || items()[0]).focus();
    });
    btn.addEventListener("keydown", function (e) { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); (e.key === "ArrowDown" ? items()[0] : items()[items().length - 1]).focus(); } });
    menu.addEventListener("keydown", function (e) {
      var list = items(), i = list.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (e.key === "Home") { e.preventDefault(); list[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); list[list.length - 1].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "Tab") close(false);
    });
    document.addEventListener("mousedown", function (e) { if (!wrap.contains(e.target)) close(false); });
    wrap.appendChild(btn); wrap.appendChild(menu);
    return wrap;
  }

  /* ---- copy buttons: code blocks, and inline addresses / hashes / URLs ---- */
  var ICON_COPY = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>';
  var ICON_CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {          // fallback for non-secure contexts / older browsers
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (e) { reject(e); } finally { ta.remove(); }
    });
  }
  function makeCopyButton(getText, label, cls) {
    var b = document.createElement("button"); b.type = "button"; b.className = "k3-copy " + (cls || "");
    b.setAttribute("aria-label", label); b.title = label; b.innerHTML = ICON_COPY;
    var timer;
    b.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      copyText(getText()).then(function () {
        b.classList.add("copied"); b.innerHTML = ICON_CHECK; b.setAttribute("aria-label", "Copied"); b.title = "Copied";
        clearTimeout(timer);
        timer = setTimeout(function () { b.classList.remove("copied"); b.innerHTML = ICON_COPY; b.setAttribute("aria-label", label); b.title = label; }, 1800);
      }, function () { b.title = "Copy failed - select the text and copy it manually"; });
    });
    return b;
  }
  function wrapCode() {
    [].forEach.call(document.querySelectorAll(".markdown-section pre"), function (pre) {
      if (pre.parentElement.classList.contains("k3-code") || pre.querySelector("code.lang-mermaid")) return;   // diagrams are not code to copy
      var wrap = document.createElement("div"); wrap.className = "k3-code";
      pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre);
      wrap.appendChild(makeCopyButton(function () { return pre.innerText.replace(/\n$/, ""); }, "Copy code", "k3-copy-block"));
    });
    [].forEach.call(document.querySelectorAll(".markdown-section :not(pre) > code"), function (c) {
      var t = c.textContent.trim();
      var isHex = /^0x[0-9a-fA-F]{40,}$/.test(t), isUrl = /^https?:\/\/\S+$/.test(t);
      if ((!isHex && !isUrl) || (c.nextElementSibling && c.nextElementSibling.classList.contains("k3-copy"))) return;
      c.insertAdjacentElement("afterend", makeCopyButton(function () { return t; }, isUrl ? "Copy URL" : "Copy " + (t.length > 42 ? "hash" : "address"), "k3-copy-inline"));
    });
  }

  var firstInit = true;
  function init() { buildTopbar(); buildBackdrop(); syncSidebar(firstInit); firstInit = false; markSectionTitles(); fitNav(); buildHeader(); wrapTables(); wrapCode(); buildInlineToc(); buildToc(); buildPager(); }
  gitbook.events.bind("page.change", init);
  init();
});
