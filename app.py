from __future__ import annotations

import html
import os
import sqlite3
from contextlib import contextmanager
from datetime import date, timedelta
from math import ceil
from pathlib import Path
from typing import Any, Iterator, Optional

import streamlit as st


APP_TITLE = "O Santuário do Eremita Literário"
DATABASE_PATH = Path(
    os.environ.get(
        "SANTUARIO_DATABASE",
        str(Path(__file__).with_name("santuario_leitura.db")),
    )
)


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                total_pages INTEGER NOT NULL CHECK (total_pages > 0),
                start_date TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS checkins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                reading_date TEXT NOT NULL,
                current_page INTEGER NOT NULL CHECK (current_page >= 0),
                UNIQUE (book_id, reading_date)
            );
            """
        )


def add_book(title: str, author: str, total_pages: int, start_date: date) -> None:
    with get_connection() as connection:
        connection.execute(
            "INSERT INTO books (title, author, total_pages, start_date) VALUES (?, ?, ?, ?)",
            (title.strip(), author.strip(), total_pages, start_date.isoformat()),
        )


def list_books() -> list[sqlite3.Row]:
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT books.*,
                   COALESCE((
                       SELECT current_page
                       FROM checkins
                       WHERE checkins.book_id = books.id
                       ORDER BY reading_date DESC, id DESC
                       LIMIT 1
                   ), 0) AS current_page
            FROM books
            ORDER BY books.id DESC
            """
        ).fetchall()


def get_checkins(book_id: int) -> list[sqlite3.Row]:
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT reading_date, current_page
            FROM checkins
            WHERE book_id = ?
            ORDER BY reading_date DESC
            LIMIT 10
            """,
            (book_id,),
        ).fetchall()


def save_checkin(book_id: int, current_page: int, reading_date: date) -> Optional[str]:
    with get_connection() as connection:
        book = connection.execute(
            "SELECT total_pages FROM books WHERE id = ?", (book_id,)
        ).fetchone()
        if book is None:
            return "Este livro não está mais no catálogo. Atualize a página e tente novamente."
        if current_page < 0 or current_page > book["total_pages"]:
            return f"A página deve estar entre 0 e {book['total_pages']}."

        previous = connection.execute(
            """
            SELECT current_page
            FROM checkins
            WHERE book_id = ? AND reading_date < ?
            ORDER BY reading_date DESC, id DESC
            LIMIT 1
            """,
            (book_id, reading_date.isoformat()),
        ).fetchone()
        if previous is not None and current_page < previous["current_page"]:
            return (
                f"Seu registro anterior foi na página {previous['current_page']}. "
                "O novo registro não pode retroceder."
            )

        connection.execute(
            """
            INSERT INTO checkins (book_id, reading_date, current_page)
            VALUES (?, ?, ?)
            ON CONFLICT (book_id, reading_date)
            DO UPDATE SET current_page = excluded.current_page
            """,
            (book_id, reading_date.isoformat(), current_page),
        )
    return None


def season_name(day: date) -> str:
    if day.month in (12, 1, 2):
        return "verão"
    if day.month in (3, 4, 5):
        return "outono"
    if day.month in (6, 7, 8):
        return "inverno"
    return "primavera"


def poetic_forecast(average: float, finish_date: date) -> str:
    month_names = (
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    )
    if average >= 20:
        pace = "Com passos firmes e páginas vorazes"
    elif average >= 8:
        pace = "No compasso constante de sua leitura"
    else:
        pace = "No ritmo sereno que sua jornada pede"
    return (
        f"{pace}, este tomo se concluirá sob o sol de {season_name(finish_date)} "
        f"em {finish_date.day} de {month_names[finish_date.month - 1]}."
    )


def inject_styles() -> None:
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=Lora:wght@400;500;600&display=swap');

        :root {
            --mahogany: #160f0b;
            --wood: #221711;
            --parchment: #f5ebd9;
            --ink: #2c221e;
            --gold: #c5a059;
            --muted-gold: #9c793f;
        }
        html, body, [class*="css"] { font-family: 'Lora', Georgia, serif; }
        .stApp {
            color: var(--parchment);
            background:
                radial-gradient(ellipse at 50% 5%, rgba(116, 72, 39, .24), transparent 48%),
                repeating-linear-gradient(90deg, rgba(255,255,255,.012) 0, rgba(255,255,255,.012) 2px, transparent 2px, transparent 7px),
                linear-gradient(135deg, #160f0b, #241710 48%, #130d09);
        }
        [data-testid="stHeader"] { background: rgba(22, 15, 11, .72); }
        [data-testid="stSidebar"] {
            background:
                repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0, rgba(255,255,255,.018) 1px, transparent 1px, transparent 5px),
                linear-gradient(160deg, #291a12, #160f0b 72%);
            border-right: 1px solid rgba(197,160,89,.55);
            box-shadow: 12px 0 34px rgba(0,0,0,.4);
        }
        [data-testid="stSidebar"] > div:first-child { padding-top: 1.4rem; }
        h1, h2, h3, [data-testid="stMetricLabel"] {
            font-family: 'Cinzel', 'Cormorant Garamond', Georgia, serif !important;
            color: var(--gold) !important;
            letter-spacing: .045em;
        }
        h1 { text-shadow: 0 3px 14px rgba(0,0,0,.7); }
        p, label, [data-testid="stMarkdownContainer"] { color: #eadcc4; }
        [data-testid="stMetric"] {
            padding: 1rem 1.15rem;
            background: linear-gradient(145deg, rgba(57,38,25,.96), rgba(31,20,14,.98));
            border: 1px solid #8e6e3c;
            outline: 1px solid rgba(197,160,89,.25);
            outline-offset: -5px;
            box-shadow: 0 10px 24px rgba(0,0,0,.38), inset 0 1px rgba(255,255,255,.08);
        }
        [data-testid="stMetricValue"] { color: var(--parchment) !important; font-family: 'Cormorant Garamond', serif; }
        [data-testid="stMetricLabel"] { color: var(--gold) !important; }
        [data-testid="stForm"] {
            padding: 1.15rem;
            border: 1px solid rgba(197,160,89,.6);
            background: linear-gradient(145deg, rgba(44,30,21,.93), rgba(25,17,12,.98));
            box-shadow: 0 12px 28px rgba(0,0,0,.36), inset 0 0 0 4px rgba(197,160,89,.055);
        }
        input, textarea, [data-baseweb="select"] > div, [data-testid="stDateInput"] input {
            color: var(--ink) !important;
            background: linear-gradient(135deg, #f8efdf, #e8d8ba) !important;
            border: 1px solid #9c793f !important;
            box-shadow: inset 0 2px 5px rgba(70,48,25,.16), 0 2px 5px rgba(0,0,0,.18);
        }
        [data-testid="stNumberInput"] button { color: var(--ink) !important; }
        .stButton > button, [data-testid="stFormSubmitButton"] button {
            color: #f8edd8 !important;
            font-family: 'Cinzel', Georgia, serif !important;
            font-weight: 600 !important;
            letter-spacing: .04em;
            border: 1px solid #d5b66e !important;
            border-radius: 3px !important;
            background: linear-gradient(145deg, #b38c48, #74542b 52%, #a67c3c) !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.34), inset 0 -2px 0 rgba(39,23,11,.42), 0 5px 13px rgba(0,0,0,.4);
            text-shadow: 0 1px 2px #382412;
            transition: filter .18s ease, transform .18s ease;
        }
        .stButton > button:hover, [data-testid="stFormSubmitButton"] button:hover {
            filter: brightness(1.16);
            transform: translateY(-1px);
            border-color: #f0d48a !important;
        }
        [data-testid="stTabs"] button { color: #e7d5b7 !important; font-family: 'Cinzel', serif; }
        [data-testid="stTabs"] button[aria-selected="true"] { color: var(--gold) !important; }
        hr { border-color: rgba(197,160,89,.38) !important; }
        .hero {
            position: relative; text-align: center; padding: 1.45rem 1rem 1.2rem;
            margin: .25rem 0 1.35rem;
            border-top: 1px solid rgba(197,160,89,.72);
            border-bottom: 1px solid rgba(197,160,89,.72);
            background: linear-gradient(90deg, transparent, rgba(104,72,37,.18), transparent);
        }
        .hero:before, .hero:after { content: '❧'; color: var(--gold); padding: 0 .7rem; }
        .hero h1 { font-family: 'Cinzel', serif; font-size: clamp(1.6rem, 3vw, 2.45rem); margin: .15rem 0; }
        .hero p { font-family: 'Cormorant Garamond', serif; font-size: 1.25rem; color: #d7c09a; margin: .25rem 0; font-style: italic; }
        .section-title {
            color: var(--gold); font: 600 1.35rem 'Cinzel', serif; margin: 1.1rem 0 .5rem;
            border-bottom: 1px solid rgba(197,160,89,.4); padding-bottom: .45rem;
        }
        .book-card {
            color: var(--ink); padding: 1.15rem 1.3rem; margin: .55rem 0 1rem;
            background:
                repeating-linear-gradient(0deg, rgba(88,62,34,.025) 0, rgba(88,62,34,.025) 1px, transparent 1px, transparent 4px),
                linear-gradient(125deg, #f8f0e2, #eadbc1);
            border: 1px solid #b18b50; outline: 1px solid rgba(197,160,89,.46); outline-offset: -6px;
            box-shadow: 0 12px 24px rgba(0,0,0,.4), inset 0 1px rgba(255,255,255,.75);
        }
        .book-card h3 { color: #3a291d !important; font: 700 1.45rem 'Cormorant Garamond', serif !important; margin: 0 0 .1rem; }
        .book-card p { color: #574536; margin: .15rem 0 .7rem; }
        .book-meta { color: #725b40; font-size: .88rem; }
        .progress-track { height: 11px; background: #d1bea0; border: 1px solid #9f7d49; box-shadow: inset 0 2px 4px rgba(0,0,0,.18); }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #866331, #d0ad60, #a27a39); box-shadow: inset 0 1px rgba(255,255,255,.45); }
        .book-card .progress-copy { color: #513d29; font-size: .86rem; margin-top: .35rem; }
        .poem {
            padding: 1rem 1.2rem; margin: .8rem 0 1.2rem; color: #ead8b8;
            background: linear-gradient(120deg, rgba(75,49,29,.72), rgba(36,24,16,.72));
            border-left: 3px solid var(--gold); box-shadow: 0 7px 18px rgba(0,0,0,.26);
            font: italic 1.2rem 'Cormorant Garamond', serif;
        }
        .empty-note { text-align: center; color: #d9c7a6; font: italic 1.2rem 'Cormorant Garamond', serif; padding: 1.5rem; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_book_card(book: Any) -> None:
    total = int(book["total_pages"])
    current = min(int(book["current_page"]), total)
    progress = current / total * 100
    title = html.escape(book["title"])
    author = html.escape(book["author"])
    start = date.fromisoformat(book["start_date"]).strftime("%d/%m/%Y")
    st.markdown(
        f"""
        <article class="book-card">
            <h3>{title}</h3>
            <p>por {author}</p>
            <div class="book-meta">Iniciado em {start} &nbsp;·&nbsp; {total} páginas</div>
            <div class="progress-track"><div class="progress-fill" style="width:{progress:.2f}%"></div></div>
            <div class="progress-copy">Página {current} de {total} &nbsp;·&nbsp; {progress:.1f}% percorrido</div>
        </article>
        """,
        unsafe_allow_html=True,
    )


def render_history(book_id: int) -> None:
    records = get_checkins(book_id)
    if not records:
        st.markdown(
            '<div class="empty-note">Ainda não há anotações nas margens deste tomo.</div>',
            unsafe_allow_html=True,
        )
        return
    for record in records:
        reading_day = date.fromisoformat(record["reading_date"]).strftime("%d/%m/%Y")
        st.markdown(
            f"- **{reading_day}** — página {int(record['current_page'])}"
        )


def main() -> None:
    st.set_page_config(
        page_title=APP_TITLE,
        page_icon="📚",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    inject_styles()
    initialize_database()

    st.markdown(
        f"""
        <header class="hero">
            <h1>{APP_TITLE}</h1>
            <p>Um refúgio de papel, silêncio e jornadas por concluir</p>
        </header>
        """,
        unsafe_allow_html=True,
    )

    with st.sidebar:
        st.markdown("## Nova ficha de catálogo")
        st.markdown(
            "Registre o próximo volume que fará companhia às suas noites."
        )
        with st.form("book_registration", clear_on_submit=True):
            title = st.text_input("Título do livro")
            author = st.text_input("Autor")
            total_pages = st.number_input(
                "Total de páginas", min_value=1, max_value=100_000, value=250, step=1
            )
            start_date = st.date_input(
                "Data de início", value=date.today(), max_value=date.today()
            )
            submitted = st.form_submit_button("Guardar na biblioteca", use_container_width=True)
            if submitted:
                if not title.strip() or not author.strip():
                    st.error("Preencha o título e o nome do autor para criar a ficha.")
                elif start_date > date.today():
                    st.error("A data de início não pode estar no futuro.")
                else:
                    add_book(title, author, int(total_pages), start_date)
                    st.success("A ficha foi guardada na biblioteca.")

    books = list_books()
    if not books:
        st.markdown(
            '<div class="empty-note">A biblioteca aguarda seu primeiro tomo. '
            'Preencha uma ficha no painel à esquerda para começar.</div>',
            unsafe_allow_html=True,
        )
        return

    book_by_id = {int(book["id"]): book for book in books}
    book_labels = {
        int(book["id"]): f'{book["title"]} — {book["author"]}' for book in books
    }

    catalog_tab, checkin_tab, panel_tab = st.tabs(
        ["A Biblioteca", "Diário de Leitura", "Painel do Eremita"]
    )

    with catalog_tab:
        st.markdown('<div class="section-title">Volumes em sua biblioteca</div>', unsafe_allow_html=True)
        columns = st.columns(2)
        for index, book in enumerate(books):
            with columns[index % 2]:
                render_book_card(book)

    with checkin_tab:
        st.markdown('<div class="section-title">Anotar o progresso de hoje</div>', unsafe_allow_html=True)
        selected_id = st.selectbox(
            "Escolha o tomo",
            options=list(book_by_id),
            format_func=lambda book_id: book_labels[book_id],
            key="checkin_book",
        )
        selected_book = book_by_id[selected_id]
        current_page = st.number_input(
            "Página atual",
            min_value=0,
            max_value=int(selected_book["total_pages"]),
            value=int(selected_book["current_page"]),
            step=1,
            key=f"page_{selected_id}",
        )
        st.caption(f"Data do registro: {date.today().strftime('%d/%m/%Y')}")
        if st.button("Registrar nas margens", key="save_checkin"):
            error = save_checkin(selected_id, int(current_page), date.today())
            if error:
                st.error(error)
            else:
                st.success("Seu progresso de hoje foi registrado.")
                st.rerun()

        st.markdown('<div class="section-title">Registros recentes</div>', unsafe_allow_html=True)
        render_history(selected_id)

    with panel_tab:
        st.markdown('<div class="section-title">Leitura das suas jornadas</div>', unsafe_allow_html=True)
        analytics_id = st.selectbox(
            "Tomo em análise",
            options=list(book_by_id),
            format_func=lambda book_id: book_labels[book_id],
            key="analytics_book",
        )
        book = book_by_id[analytics_id]
        total_pages = int(book["total_pages"])
        current = min(int(book["current_page"]), total_pages)
        remaining = max(total_pages - current, 0)
        started = date.fromisoformat(book["start_date"])
        elapsed_days = max((date.today() - started).days + 1, 1)
        average = current / elapsed_days
        percentage = current / total_pages * 100

        metric_columns = st.columns(4)
        metric_columns[0].metric("Progresso", f"{percentage:.1f}%")
        metric_columns[1].metric("Páginas lidas", f"{current:,}".replace(",", "."))
        metric_columns[2].metric("Páginas restantes", f"{remaining:,}".replace(",", "."))
        metric_columns[3].metric(
            "Média diária real",
            f"{average:.1f} pág./dia" if current else "—",
        )

        if remaining == 0:
            finish_date = date.today()
            st.markdown(
                '<div class="poem">O último capítulo já repousa em suas mãos. '
                'Que esta história permaneça acesa na memória.</div>',
                unsafe_allow_html=True,
            )
        elif average > 0:
            finish_date = date.today() + timedelta(days=ceil(remaining / average))
            st.markdown(
                f'<div class="poem">{html.escape(poetic_forecast(average, finish_date))}</div>',
                unsafe_allow_html=True,
            )
        else:
            finish_date = None
            st.markdown(
                '<div class="poem">Toda grande jornada começa com uma página. '
                'Faça seu primeiro registro e o horizonte desta leitura se revelará.</div>',
                unsafe_allow_html=True,
            )

        if finish_date is not None:
            st.metric("Término estimado", finish_date.strftime("%d/%m/%Y"))
        st.caption(
            f"A média considera {elapsed_days} "
            f"{'dia' if elapsed_days == 1 else 'dias'} desde o início da leitura."
        )
        st.markdown('<div class="section-title">Anotações recentes</div>', unsafe_allow_html=True)
        render_history(analytics_id)


if __name__ == "__main__":
    main()
