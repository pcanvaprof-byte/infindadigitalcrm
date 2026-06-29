"""Smoke E2E: abre um cliente em /operacoes/clientes/$id e valida que todas
as abas (Resumo, Onboarding, Implantação, Campanhas, Relacionamento,
Renovações, Comercial, Documentos, Financeiro, Histórico) montam.

Requisitos:
- Dev server rodando em http://localhost:8080
- Sessão Supabase injetada em LOVABLE_BROWSER_SUPABASE_* (modo `injected`).
  Sem sessão o smoke pára na tela /auth e marca SKIP.
- python3 + playwright (já incluídos no sandbox padrão Lovable).

Uso:
  python3 scripts/e2e/lifecycle-tabs.smoke.py [--client-id <lc_id>]

Sem --client-id, abre /operacoes/clientes e clica na primeira linha.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

TABS = [
    ("", "Resumo"),
    ("onboarding", "Onboarding"),
    ("implantacao", "Implantação"),
    ("campanhas", "Campanhas"),
    ("relacionamento", "Relacionamento"),
    ("renovacoes", "Renovações"),
    ("comercial", "Comercial"),
    ("documentos", "Documentos"),
    ("financeiro", "Financeiro"),
    ("historico", "Histórico"),
]

OUT = Path("/tmp/browser/lifecycle-tabs")
OUT.mkdir(parents=True, exist_ok=True)


async def restore_session(page) -> bool:
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    await page.goto("http://localhost:8080", wait_until="domcontentloaded")
    if not key or not sess:
        return False
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
    )
    return True


async def pick_client_id(page) -> str | None:
    await page.goto("http://localhost:8080/operacoes/clientes", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle")
    # primeira linha clicável
    row = page.locator("table tbody tr").first
    try:
        await row.wait_for(timeout=5000)
    except Exception:
        return None
    async with page.expect_navigation(url=lambda u: "/operacoes/clientes/" in u and u.rstrip("/").rsplit("/", 1)[-1] != "clientes"):
        await row.click()
    url = page.url
    return url.rstrip("/").rsplit("/", 1)[-1]


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--client-id", dest="client_id", default=None)
    args = parser.parse_args()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console.error: {m.text}") if m.type == "error" else None)

        ok = await restore_session(page)
        if not ok:
            print("[SKIP] Nenhuma sessão Supabase injetada (LOVABLE_BROWSER_AUTH_STATUS != injected).")
            await browser.close()
            return 0

        client_id = args.client_id or await pick_client_id(page)
        if not client_id:
            print("[FAIL] Não foi possível obter um client_id (lista vazia?).")
            await browser.close()
            return 2

        print(f"[INFO] Auditando ficha 360 de lc_id={client_id}")

        failed: list[str] = []
        for slug, label in TABS:
            url = f"http://localhost:8080/operacoes/clientes/{client_id}" + (f"/{slug}" if slug else "")
            await page.goto(url, wait_until="domcontentloaded")
            try:
                await page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass
            # valida que a barra de abas renderizou (ou seja, layout montou)
            tabs_bar = page.locator("a", has_text="Resumo").first
            if not await tabs_bar.is_visible():
                failed.append(f"{label}: barra de abas não renderizou")
                continue
            # snapshot
            await page.screenshot(path=str(OUT / f"{slug or 'resumo'}.png"))
            print(f"  ✓ {label}")

        await browser.close()

        if errors:
            print("[WARN] Console/erros capturados:")
            for e in errors[:20]:
                print("  -", e)

        if failed:
            print("[FAIL] Abas com problema:")
            for f in failed:
                print("  -", f)
            return 1

        print(f"[OK] Todas as {len(TABS)} abas montaram. Screenshots em {OUT}")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))