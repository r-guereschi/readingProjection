"use strict";

(() => {
  const STORAGE_KEY = "santuario-literario-v1";
  const today = new Date();
  const localDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const todayValue = localDate(today);
  const parseDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  };
  const dateLabel = (value) =>
    parseDate(value).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const shortDate = (value) =>
    parseDate(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const dayCount = (from, to) => {
    const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
    const [toYear, toMonth, toDay] = to.split("-").map(Number);
    return Math.max(
      1,
      (Date.UTC(toYear, toMonth - 1, toDay) -
        Date.UTC(fromYear, fromMonth - 1, fromDay)) /
        86400000 +
        1,
    );
  };
  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
    );
  const isIsoDate = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    localDate(parseDate(value)) === value;
  const makeId = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  const form = document.getElementById("book-form");
  const startInput = document.getElementById("start-date");
  const list = document.getElementById("book-list");
  const archiveNotice = document.getElementById("archive-notice");
  let activeBookId = "";
  let storageError = "";

  startInput.max = todayValue;
  startInput.value = todayValue;
  document.getElementById("today-label").textContent = today.toLocaleDateString(
    "pt-BR",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  );

  function setNotice(element, text, isError = false) {
    element.className = isError ? "notice error" : "notice";
    element.textContent = text;
  }

  function validBook(book) {
    return Boolean(
      book &&
        typeof book.id === "string" &&
        typeof book.title === "string" &&
        book.title.trim() &&
        typeof book.author === "string" &&
        book.author.trim() &&
        Number.isInteger(book.totalPages) &&
        book.totalPages > 0 &&
        isIsoDate(book.startDate) &&
        book.startDate <= todayValue &&
        Array.isArray(book.logs) &&
        book.logs.every(
          (entry, index, entries) =>
            entry &&
            isIsoDate(entry.date) &&
            entry.date <= todayValue &&
            Number.isInteger(entry.page) &&
            entry.page > 0 &&
            entry.page <= book.totalPages &&
            (index === 0 ||
              (entry.page > entries[index - 1].page &&
                entry.date >= entries[index - 1].date)),
        ),
    );
  }

  function loadBooks() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(saved) || !saved.every(validBook)) {
        throw new Error("Formato da biblioteca inválido.");
      }
      return saved;
    } catch (error) {
      console.error("Não foi possível ler a biblioteca local:", error);
      storageError =
        "Não foi possível ler os registros locais. Restaure uma cópia válida na aba Arquivo.";
      return [];
    }
  }

  let books = loadBooks();

  function saveBooks(errorTarget = archiveNotice) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
      storageError = "";
      return true;
    } catch (error) {
      console.error("Não foi possível salvar a biblioteca local:", error);
      setNotice(
        errorTarget,
        "Falha ao salvar. Verifique o espaço disponível no navegador.",
        true,
      );
      return false;
    }
  }

  function currentPage(book) {
    return book.logs.reduce((max, entry) => Math.max(max, entry.page), 0);
  }

  function details(book) {
    const current = currentPage(book);
    const remaining = Math.max(0, book.totalPages - current);
    const elapsed = dayCount(book.startDate, todayValue);
    const average = current / elapsed;
    const percent = Math.min(
      100,
      Math.round((current / book.totalPages) * 100),
    );
    let forecast = "Registre seu primeiro avanço para revelar uma data.";

    if (remaining === 0) {
      forecast = "Este tomo foi concluído. Que outra jornada venha iluminar a mesa.";
    } else if (average > 0) {
      const finish = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + Math.ceil(remaining / average),
        12,
      );
      const month = finish.getMonth();
      const season = [11, 0, 1].includes(month)
        ? "sob o sol de inverno"
        : [2, 3, 4].includes(month)
          ? "na luz dourada da primavera"
          : [5, 6, 7].includes(month)
            ? "sob o sol de verão"
            : "entre as brisas do outono";
      forecast = `No ritmo atual, sua jornada neste tomo se concluirá ${season}, em ${finish.toLocaleDateString(
        "pt-BR",
        { day: "numeric", month: "long" },
      )}.`;
    }
    return { current, remaining, average, percent, forecast };
  }

  function renderAnalytics() {
    const totalPages = books.reduce(
      (sum, book) => sum + currentPage(book),
      0,
    );
    const earliestStart = books.reduce(
      (earliest, book) =>
        book.startDate < earliest ? book.startDate : earliest,
      todayValue,
    );
    const average = books.length
      ? totalPages / dayCount(earliestStart, todayValue)
      : 0;
    const remainingPages = books.reduce(
      (sum, book) => sum + Math.max(0, book.totalPages - currentPage(book)),
      0,
    );
    const completed = books.filter(
      (book) => currentPage(book) >= book.totalPages,
    ).length;
    const metrics = [
      [books.length, "tomos na estante"],
      [totalPages.toLocaleString("pt-BR"), "páginas percorridas"],
      [remainingPages.toLocaleString("pt-BR"), "páginas restantes"],
      [average.toFixed(1).replace(".", ","), "páginas por dia"],
      [completed, "jornadas concluídas"],
    ];
    document.getElementById("analytics").innerHTML = metrics
      .map(
        ([value, label]) =>
          `<div class="metric"><span class="metric-value">${escapeHtml(
            value,
          )}</span><span class="metric-label">${escapeHtml(label)}</span></div>`,
      )
      .join("");

    const nextBook = books.find(
      (book) => currentPage(book) < book.totalPages,
    );
    document.getElementById("prophesy").textContent = !books.length
      ? "A biblioteca aguarda o primeiro capítulo de sua jornada."
      : nextBook
        ? details(nextBook).forecast
        : `Todas as jornadas estão concluídas — ${totalPages.toLocaleString(
            "pt-BR",
          )} páginas guardadas na memória.`;
  }

  function renderOverview() {
    const overviewBooks = document.getElementById("overview-books");
    const activeBooks = books
      .filter((book) => currentPage(book) < book.totalPages)
      .slice(0, 3);

    if (!activeBooks.length) {
      overviewBooks.innerHTML = `<div class="empty"><span class="empty-symbol">❧</span>${
        books.length
          ? "Todas as jornadas foram concluídas."
          : "A estante ainda está em silêncio."
      }</div>`;
    } else {
      overviewBooks.innerHTML = activeBooks
        .map((book) => {
          const info = details(book);
          return `<div class="overview-book"><div><strong>${escapeHtml(
            book.title,
          )}</strong><span>${info.current.toLocaleString(
            "pt-BR",
          )} de ${book.totalPages.toLocaleString(
            "pt-BR",
          )} páginas · ${info.percent}%</span></div><button class="quiet-button small-button" type="button" data-start-checkin="${escapeHtml(
            book.id,
          )}">Continuar</button></div>`;
        })
        .join("");
    }

    const recent = books
      .flatMap((book) =>
        book.logs.map((entry) => ({ ...entry, title: book.title })),
      )
      .sort(
        (left, right) =>
          right.date.localeCompare(left.date) || right.page - left.page,
      )
      .slice(0, 5);
    document.getElementById("activity-list").innerHTML = recent.length
      ? recent
          .map(
            (entry) =>
              `<li><strong>${escapeHtml(
                entry.title,
              )}</strong> · página ${entry.page.toLocaleString(
                "pt-BR",
              )}<time>${escapeHtml(shortDate(entry.date))}</time></li>`,
          )
          .join("")
      : "<li>Nenhum avanço registrado por enquanto. Cada jornada começa com uma página.</li>";
  }

  function renderShelf() {
    if (!books.length) {
      list.innerHTML =
        '<div class="empty"><span class="empty-symbol">❧</span>A estante ainda está em silêncio.<br>Cadastre um livro para iniciar sua jornada.</div>';
      return;
    }
    list.innerHTML = books
      .map((book) => {
        const info = details(book);
        return `<article class="book-card" data-book-id="${escapeHtml(
          book.id,
        )}">
          <div class="book-top"><div><h3 class="book-title">${escapeHtml(
            book.title,
          )}</h3><p class="book-author">por ${escapeHtml(
          book.author,
        )}</p></div><div class="book-pages">${book.totalPages.toLocaleString(
          "pt-BR",
        )} págs.</div></div>
          <div class="book-meta"><span>Iniciada em ${escapeHtml(
            dateLabel(book.startDate),
          )}</span><span>${info.remaining.toLocaleString(
          "pt-BR",
        )} páginas restantes</span></div>
          <div class="progress-track" role="progressbar" aria-label="Progresso de ${escapeHtml(
            book.title,
          )}" aria-valuenow="${info.percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${
          info.percent
        }%"></div></div>
          <div class="progress-label"><span>${info.current.toLocaleString(
            "pt-BR",
          )} de ${book.totalPages.toLocaleString(
          "pt-BR",
        )} páginas</span><strong>${info.percent}%</strong></div>
          <p class="prophesy" style="margin:12px 0 0 9px;color:#604a32;background:rgba(119,76,43,.08)">${escapeHtml(
          info.forecast,
        )}</p>
          <div class="book-actions"><button type="button" class="gold-button small-button" data-start-checkin="${escapeHtml(
          book.id,
        )}" ${info.remaining === 0 ? "disabled" : ""}>✎ Registrar leitura</button><button type="button" class="danger-button" data-delete="${escapeHtml(
          book.id,
        )}" style="margin-left:8px">Retirar da estante</button></div>
        </article>`;
      })
      .join("");
  }

  function renderCheckin() {
    const select = document.getElementById("checkin-book");
    const empty = document.getElementById("checkin-empty");
    const workspace = document.getElementById("checkin-workspace");
    if (!books.length) {
      empty.hidden = false;
      workspace.hidden = true;
      return;
    }

    empty.hidden = true;
    workspace.hidden = false;
    if (!books.some((book) => book.id === activeBookId)) {
      activeBookId = books[0].id;
    }
    select.innerHTML = books
      .map(
        (book) =>
          `<option value="${escapeHtml(book.id)}">${escapeHtml(
            book.title,
          )} — ${escapeHtml(book.author)}</option>`,
      )
      .join("");
    select.value = activeBookId;

    const book = books.find((item) => item.id === activeBookId);
    const info = details(book);
    const pageInput = document.getElementById("current-page");
    pageInput.min = Math.min(info.current + 1, book.totalPages);
    pageInput.max = book.totalPages;
    pageInput.value = String(Math.min(info.current + 1, book.totalPages));
    pageInput.disabled = info.remaining === 0;
    document.querySelector("#checkin-form button").disabled =
      info.remaining === 0;
    document.getElementById("checkin-date").textContent =
      today.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
    document.getElementById("checkin-details").innerHTML = `
      <div class="checkin-current"><span>Progresso atual</span><strong>${info.current.toLocaleString(
        "pt-BR",
      )} / ${book.totalPages.toLocaleString(
      "pt-BR",
    )} · ${info.percent}%</strong></div>
      <div class="progress-track" role="progressbar" aria-label="Progresso de ${escapeHtml(
        book.title,
      )}" aria-valuenow="${info.percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${
      info.percent
    }%"></div></div>
      <p style="color:#d7c3a2;font-size:.82rem">${info.remaining.toLocaleString(
        "pt-BR",
      )} páginas até o fim deste tomo.</p>`;

    const history = [...book.logs].sort(
      (left, right) =>
        right.date.localeCompare(left.date) || right.page - left.page,
    );
    document.getElementById("checkin-history").innerHTML = history.length
      ? history
          .map(
            (entry) =>
              `<li>Página <strong>${entry.page.toLocaleString(
                "pt-BR",
              )}</strong><time>${escapeHtml(
                dateLabel(entry.date),
              )}</time></li>`,
          )
          .join("")
      : "<li>Ainda não há registros para este tomo. A primeira nota será sua.</li>";
  }

  function render() {
    renderAnalytics();
    renderOverview();
    renderShelf();
    renderCheckin();
    if (storageError) setNotice(archiveNotice, storageError, true);
  }

  function activateTab(name, focusButton = false) {
    const activePanel = document.getElementById(`panel-${name}`);
    document.querySelectorAll("[role='tab']").forEach((tab) => {
      const selected = tab.dataset.tabTarget === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll("[role='tabpanel']").forEach((panel) => {
      panel.hidden = panel.id !== `panel-${name}`;
    });
    activePanel.classList.remove("is-entering");
    void activePanel.offsetWidth;
    activePanel.classList.add("is-entering");
    if (focusButton) document.getElementById(`tab-${name}`).focus();
  }

  document
    .querySelector(".tab-navigation")
    .addEventListener("click", (event) => {
      const tab = event.target.closest("[role='tab']");
      if (tab) activateTab(tab.dataset.tabTarget);
    });

  document
    .querySelector(".tab-navigation")
    .addEventListener("keydown", (event) => {
      const tabs = [...document.querySelectorAll("[role='tab']")];
      const current = tabs.indexOf(event.target.closest("[role='tab']"));
      if (current < 0) return;
      let next = current;
      if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
      else if (event.key === "ArrowLeft")
        next = (current - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[next].dataset.tabTarget, true);
    });

  document.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open-tab]");
    if (opener) activateTab(opener.dataset.openTab);

    const checkinButton = event.target.closest("[data-start-checkin]");
    if (checkinButton) {
      activeBookId = checkinButton.dataset.startCheckin;
      renderCheckin();
      activateTab("checkin");
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = String(data.get("title")).trim();
    const author = String(data.get("author")).trim();
    const totalPages = Number(data.get("totalPages"));
    const startDate = String(data.get("startDate"));
    const message = document.getElementById("form-notice");

    if (
      !title ||
      !author ||
      !Number.isInteger(totalPages) ||
      totalPages < 1 ||
      totalPages > 1000000 ||
      !isIsoDate(startDate) ||
      startDate > todayValue
    ) {
      setNotice(
        message,
        "Informe título, autoria, total de páginas válido e uma data que não seja futura.",
        true,
      );
      return;
    }

    books.unshift({
      id: makeId(),
      title,
      author,
      totalPages,
      startDate,
      logs: [],
    });
    if (!saveBooks(message)) return;
    form.reset();
    startInput.value = todayValue;
    setNotice(message, "O tomo foi guardado em sua biblioteca.");
    render();
    activateTab("shelf");
  });

  document
    .getElementById("checkin-book")
    .addEventListener("change", (event) => {
      activeBookId = event.target.value;
      setNotice(document.getElementById("checkin-notice"), "");
      renderCheckin();
    });

  document
    .getElementById("checkin-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const book = books.find((item) => item.id === activeBookId);
      const page = Number(new FormData(event.currentTarget).get("page"));
      const message = document.getElementById("checkin-notice");

      if (
        !book ||
        !Number.isInteger(page) ||
        page <= currentPage(book) ||
        page > book.totalPages
      ) {
        setNotice(
          message,
          "O avanço deve superar a página registrada e não ultrapassar o total do livro.",
          true,
        );
        return;
      }

      book.logs.push({ date: todayValue, page });
      if (!saveBooks(message)) return;
      setNotice(message, `Avanço registrado: página ${page} de “${book.title}”.`);
      render();
    });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    const book = books.find((item) => item.id === button.dataset.delete);
    if (
      !book ||
      !window.confirm(`Retirar “${book.title}” e seus registros da estante?`)
    ) {
      return;
    }

    books = books.filter((item) => item.id !== book.id);
    if (activeBookId === book.id) activeBookId = "";
    if (saveBooks(document.getElementById("list-notice"))) render();
  });

  document
    .getElementById("export-button")
    .addEventListener("click", () => {
      const blob = new Blob(
        [JSON.stringify({ version: 1, books }, null, 2)],
        { type: "application/json" },
      );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `santuario-literario-${todayValue}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });

  document
    .getElementById("import-file")
    .addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const imported = Array.isArray(parsed) ? parsed : parsed.books;
        if (
          !Array.isArray(imported) ||
          !imported.every((book) => validBook({ ...book, id: "validation" }))
        ) {
          throw new Error("O arquivo não contém uma cópia válida do catálogo.");
        }
        if (
          !window.confirm(
            "A importação substituirá os registros atuais. Deseja continuar?",
          )
        ) {
          return;
        }
        books = imported.map((book) => ({ ...book, id: makeId() }));
        if (saveBooks(archiveNotice)) {
          setNotice(archiveNotice, "Sua cópia foi restaurada.");
          render();
        }
      } catch (error) {
        console.error("Não foi possível importar os registros:", error);
        setNotice(
          archiveNotice,
          "Não foi possível importar: verifique se o JSON é uma cópia válida do Santuário.",
          true,
        );
      } finally {
        event.target.value = "";
      }
    });

  render();
  activateTab("overview");
})();
