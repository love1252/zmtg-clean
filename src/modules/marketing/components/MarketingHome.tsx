'use client';

import { useEffect, useRef } from 'react';
import {
  defaultHomepageBrandConfig,
  type HomepageBrandConfig,
} from '@/modules/marketing/domain/homepageBrandConfig';

const luxuryCss = `\n      :root {\n        --ink: #0b1624;\n        --soft-ink: #334155;\n        --muted: #6b7888;\n        --line: rgba(11, 22, 36, 0.1);\n        --blue: #1f5fe5;\n        --teal: #0a9a91;\n        --rose: #c64c78;\n        --gold: #c79b4a;\n        --paper: #fbf7f0;\n        --white: #ffffff;\n      }\n\n      * { box-sizing: border-box; }\n\n      \n\n      .luxuryRoot {\n        margin: 0;\n        font-family: Inter, \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", sans-serif;\n        color: var(--ink);\n        background: linear-gradient(180deg, #f9f5ee 0%, #ffffff 52%, #f5f9fb 100%);\n        overflow-x: hidden;\n        color-scheme: light;\n        transition: background 360ms ease, color 360ms ease;\n      }\n\n      .page {\n        width: 100vw;\n        max-width: 1440px;\n        margin: 0 auto;\n        overflow: hidden;\n        background: #fff;\n        transition: background 360ms ease;\n      }\n\n      .hero {\n        position: relative;\n        min-height: 960px;\n        overflow: hidden;\n        background: #f8f3eb;\n        transition: background 360ms ease;\n      }\n\n      .hero-bg {\n        position: absolute;\n        inset: 0;\n        width: 100%;\n        height: 100%;\n        object-fit: cover;\n        transition: filter 420ms ease, opacity 420ms ease;\n      }\n\n      .hero-veil {\n        position: absolute;\n        inset: 0;\n        background:\n          linear-gradient(90deg, rgba(250,247,241,0.99) 0%, rgba(250,247,241,0.91) 34%, rgba(250,247,241,0.34) 67%, rgba(11,22,36,0.12) 100%),\n          radial-gradient(circle at 23% 18%, rgba(198,76,120,0.14), transparent 31%),\n          radial-gradient(circle at 70% 18%, rgba(31,95,229,0.11), transparent 34%);\n        transition: background 420ms ease;\n      }\n\n      .nav {\n        position: relative;\n        z-index: 3;\n        height: 88px;\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        padding: 0 72px;\n      }\n\n      .brand {\n        display: flex;\n        align-items: center;\n        gap: 14px;\n      }\n\n      .brand-logo-stack {\n        position: relative;\n        display: block;\n        width: 300px;\n        height: 62px;\n      }\n\n      .brand-logo-img {\n        position: absolute;\n        inset: 0 auto auto 0;\n        display: block;\n        width: auto;\n        height: 62px;\n        max-width: 300px;\n        object-fit: contain;\n        transition: opacity 260ms ease;\n      }\n\n      .brand-logo-night {\n        opacity: 0;\n      }\n\n      .mark {\n        width: 46px;\n        height: 46px;\n        border-radius: 999px;\n        display: grid;\n        place-items: center;\n        color: #fff;\n        font-weight: 900;\n        background: linear-gradient(135deg, #0b1624, #1f5fe5 56%, #0a9a91);\n        box-shadow: 0 18px 36px rgba(31,95,229,0.2);\n      }\n\n      .brand strong { display: block; font-size: 18px; }\n      .brand span { display: block; margin-top: 3px; color: #665a50; font-size: 12px; }\n\n      .links {\n        display: flex;\n        gap: 32px;\n        color: #4a4037;\n        font-size: 15px;\n        font-weight: 700;\n        transition: color 260ms ease;\n      }\n\n      .links a {\n        color: inherit;\n        text-decoration: none;\n      }\n\n      .nav-actions {\n        display: flex;\n        align-items: center;\n        gap: 12px;\n      }\n\n      .nav button, .nav .nav-button, .button, .nav-button {\n        border: 0;\n        text-decoration: none;\n        white-space: nowrap;\n        cursor: default;\n      }\n\n      .nav button, .nav .nav-button, .nav-button {\n        border-radius: 999px;\n        padding: 13px 20px;\n        color: #0b1624;\n        background: rgba(255,255,255,0.66);\n        border: 1px solid rgba(11,22,36,0.12);\n        font-weight: 850;\n        backdrop-filter: blur(16px);\n        transition: transform 240ms ease, box-shadow 240ms ease, background 240ms ease, color 240ms ease, border-color 240ms ease;\n      }\n\n      .nav button:hover, .nav .nav-button:hover {\n        transform: translateY(-2px);\n        box-shadow: 0 14px 30px rgba(11,22,36,0.09);\n        background: rgba(255,255,255,0.82);\n      }\n\n      .theme-toggle {\n        width: 46px;\n        height: 46px;\n        padding: 0 !important;\n        display: inline-grid;\n        place-items: center;\n        position: relative;\n        overflow: hidden;\n        cursor: pointer !important;\n      }\n\n      .theme-toggle span {\n        position: absolute;\n        line-height: 1;\n        transition: transform 260ms ease, opacity 260ms ease;\n      }\n\n      .theme-toggle .moon-icon {\n        opacity: 1;\n        transform: translateY(0) rotate(0deg);\n      }\n\n      .theme-toggle .sun-icon {\n        opacity: 0;\n        transform: translateY(16px) rotate(-40deg);\n      }\n\n      .theme-toggle-label {\n        width: 1px;\n        height: 1px;\n        clip: rect(0 0 0 0);\n        clip-path: inset(50%);\n        overflow: hidden;\n      }\n\n      .hero-copy {\n        position: relative;\n        z-index: 2;\n        width: 735px;\n        padding: 72px 0 0 72px;\n      }\n\n      .pill {\n        display: inline-flex;\n        align-items: center;\n        gap: 10px;\n        padding: 9px 14px;\n        border-radius: 999px;\n        color: #60452e;\n        background: rgba(255,255,255,0.7);\n        border: 1px solid rgba(199,155,74,0.32);\n        font-size: 14px;\n        font-weight: 850;\n        backdrop-filter: blur(14px);\n      }\n\n      .pill::before {\n        content: \"\";\n        width: 8px;\n        height: 8px;\n        border-radius: 999px;\n        background: var(--gold);\n        box-shadow: 0 0 0 5px rgba(199,155,74,0.15);\n      }\n\n      h1 {\n        margin: 30px 0 24px;\n        font-size: 80px;\n        line-height: 1.08;\n        letter-spacing: 0;\n      }\n\n      h1 span { display: block; }\n      h1 em {\n        display: block;\n        margin-top: 8px;\n        font-style: normal;\n        color: transparent;\n        background: linear-gradient(90deg, #c64c78 0%, #1f5fe5 54%, #0a9a91 100%);\n        -webkit-background-clip: text;\n        background-clip: text;\n      }\n\n      .lead {\n        width: 650px;\n        margin: 0;\n        color: #4f5c68;\n        font-size: 21px;\n        line-height: 1.72;\n        font-weight: 540;\n      }\n\n      .actions {\n        display: flex;\n        align-items: center;\n        gap: 14px;\n        margin-top: 38px;\n      }\n\n      .primary {\n        border-radius: 999px;\n        padding: 18px 28px;\n        color: #fff;\n        font-size: 17px;\n        font-weight: 900;\n        background: linear-gradient(135deg, #0b1624, #1f5fe5);\n        box-shadow: 0 24px 46px rgba(31,95,229,0.28);\n        transition: transform 260ms ease, box-shadow 260ms ease, filter 260ms ease;\n      }\n\n      .secondary {\n        border-radius: 999px;\n        padding: 17px 24px;\n        color: #223247;\n        font-size: 17px;\n        font-weight: 850;\n        background: rgba(255,255,255,0.62);\n        border: 1px solid rgba(11,22,36,0.12);\n        backdrop-filter: blur(16px);\n        transition: transform 260ms ease, box-shadow 260ms ease, background 260ms ease;\n      }\n\n      .primary:hover,\n      .secondary:hover {\n        transform: translateY(-3px);\n      }\n\n      .primary:hover {\n        filter: saturate(1.08);\n        box-shadow: 0 30px 58px rgba(31,95,229,0.34);\n      }\n\n      .secondary:hover {\n        background: rgba(255,255,255,0.78);\n        box-shadow: 0 18px 38px rgba(11,22,36,0.08);\n      }\n\n      .editor-note {\n        margin-top: 44px;\n        width: 590px;\n        border-left: 4px solid var(--gold);\n        padding: 5px 0 5px 18px;\n        color: #5c5147;\n        font-size: 16px;\n        line-height: 1.72;\n      }\n\n      .editor-note b { color: #0b1624; }\n\n      .metrics {\n        position: absolute;\n        left: 72px;\n        bottom: 56px;\n        z-index: 3;\n        display: grid;\n        grid-template-columns: repeat(4, 1fr);\n        width: 690px;\n        border-radius: 30px;\n        overflow: hidden;\n        border: 1px solid rgba(11,22,36,0.1);\n        background: rgba(255,255,255,0.66);\n        box-shadow: 0 28px 70px rgba(11,22,36,0.08);\n        backdrop-filter: blur(18px);\n      }\n\n      .metric {\n        padding: 27px 24px;\n        border-left: 1px solid rgba(11,22,36,0.08);\n      }\n\n      .metric:first-child { border-left: 0; }\n      .metric strong { display: block; font-size: 29px; }\n      .metric span { display: block; margin-top: 7px; color: #667486; font-size: 13px; }\n\n      .growth-card {\n        position: absolute;\n        z-index: 2;\n        right: 72px;\n        top: 158px;\n        width: 456px;\n        border-radius: 34px;\n        background:\n          linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.72));\n        border: 1px solid rgba(255,255,255,0.76);\n        box-shadow: 0 30px 78px rgba(11,22,36,0.15);\n        backdrop-filter: blur(22px);\n        padding: 24px;\n      }\n\n      .growth-card::after {\n        content: \"\";\n        position: absolute;\n        inset: 1px;\n        border-radius: inherit;\n        pointer-events: none;\n        background: linear-gradient(120deg, transparent 12%, rgba(255,255,255,0.52) 34%, transparent 52%);\n        opacity: 0;\n        transform: translateX(-34%);\n      }\n\n      .card-top {\n        display: flex;\n        align-items: flex-start;\n        justify-content: space-between;\n        gap: 18px;\n        margin-bottom: 24px;\n      }\n\n      .card-top b { display: block; font-size: 22px; }\n      .card-top span { display: block; margin-top: 6px; color: var(--muted); font-size: 13px; }\n\n      .badge {\n        border-radius: 999px;\n        padding: 8px 11px;\n        color: #0d765b;\n        background: rgba(10,154,145,0.11);\n        font-size: 12px;\n        font-weight: 900;\n      }\n\n      .funnel { display: grid; gap: 13px; }\n\n      .row {\n        padding: 14px;\n        border-radius: 18px;\n        background: rgba(255,255,255,0.74);\n        border: 1px solid rgba(11,22,36,0.06);\n      }\n\n      .row-head {\n        display: flex;\n        justify-content: space-between;\n        margin-bottom: 10px;\n        color: #516171;\n        font-size: 13px;\n      }\n\n      .row-head strong { color: #0b1624; }\n\n      .bar {\n        height: 10px;\n        border-radius: 999px;\n        background: #e9edf2;\n        overflow: hidden;\n      }\n\n      .bar i {\n        display: block;\n        height: 100%;\n        border-radius: inherit;\n        transform-origin: left center;\n      }\n\n      .advisor-inline {\n        margin-top: 18px;\n        border-radius: 24px;\n        background:\n          linear-gradient(135deg, rgba(31,95,229,0.075), rgba(10,154,145,0.075)),\n          rgba(255,255,255,0.74);\n        border: 1px solid rgba(31,95,229,0.11);\n        color: var(--ink);\n        padding: 18px 18px 17px;\n        box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);\n      }\n\n      .insight-head {\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n        gap: 16px;\n        margin-bottom: 12px;\n      }\n\n      .insight-title {\n        display: flex;\n        align-items: center;\n        gap: 10px;\n      }\n\n      .ai-dot {\n        width: 34px;\n        height: 34px;\n        border-radius: 12px;\n        display: grid;\n        place-items: center;\n        color: #fff;\n        font-size: 12px;\n        font-weight: 900;\n        background: linear-gradient(135deg, var(--blue), var(--teal));\n      }\n\n      .advisor-inline small {\n        display: block;\n        color: #456075;\n        font-size: 12px;\n        font-weight: 850;\n      }\n\n      .advisor-inline h3 {\n        margin: 2px 0 0;\n        font-size: 17px;\n        line-height: 1.35;\n      }\n\n      .confidence {\n        border-radius: 999px;\n        padding: 6px 9px;\n        color: #0d765b;\n        background: rgba(10,154,145,0.12);\n        font-size: 12px;\n        font-weight: 900;\n      }\n\n      .advisor-inline p { margin: 0; color: #526171; line-height: 1.68; font-size: 13px; }\n\n      .chips {\n        display: flex;\n        flex-wrap: wrap;\n        gap: 8px;\n        margin-top: 14px;\n      }\n\n      .chips span {\n        border-radius: 999px;\n        padding: 7px 9px;\n        color: #1f5fe5;\n        background: rgba(31,95,229,0.08);\n        font-size: 12px;\n        font-weight: 800;\n      }\n\n      section.band {\n        padding: 98px 72px;\n      }\n\n      .section-head {\n        display: grid;\n        grid-template-columns: 0.7fr 1fr;\n        gap: 80px;\n        align-items: end;\n        margin-bottom: 48px;\n      }\n\n      .kicker {\n        color: var(--gold);\n        font-size: 14px;\n        font-weight: 900;\n        letter-spacing: 0.12em;\n      }\n\n      h2 {\n        margin: 12px 0 0;\n        font-size: 46px;\n        line-height: 1.22;\n        letter-spacing: 0;\n      }\n\n      .section-head p {\n        margin: 0;\n        color: #5e6b7a;\n        font-size: 18px;\n        line-height: 1.72;\n      }\n\n      .diagnosis {\n        background: #fff;\n      }\n\n      .diagnosis-grid {\n        display: grid;\n        grid-template-columns: repeat(4, 1fr);\n        gap: 18px;\n      }\n\n      .diag {\n        min-height: 240px;\n        border-radius: 26px;\n        padding: 26px;\n        border: 1px solid var(--line);\n        background: linear-gradient(180deg, #fff, #fbfdff);\n        box-shadow: 0 18px 44px rgba(15, 23, 42, 0.05);\n      }\n\n      .diag .num {\n        width: 42px;\n        height: 42px;\n        border-radius: 14px;\n        display: grid;\n        place-items: center;\n        margin-bottom: 42px;\n        color: #fff;\n        font-weight: 900;\n        background: #0b1624;\n      }\n\n      .diag h3 {\n        margin: 0;\n        font-size: 21px;\n      }\n\n      .diag p {\n        margin: 12px 0 0;\n        color: #647284;\n        line-height: 1.68;\n        font-size: 14px;\n      }\n\n      .journey {\n        background: linear-gradient(180deg, #f7fbfd 0%, #fff 100%);\n      }\n\n      .journey-layout {\n        display: grid;\n        grid-template-columns: 1fr 1.08fr;\n        gap: 36px;\n        align-items: stretch;\n      }\n\n      .journey-panel {\n        border-radius: 32px;\n        border: 1px solid var(--line);\n        background: #fff;\n        padding: 30px;\n        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.07);\n      }\n\n      .timeline {\n        display: grid;\n        gap: 18px;\n      }\n\n      .timeline-item {\n        display: grid;\n        grid-template-columns: 54px 1fr;\n        gap: 16px;\n        align-items: start;\n        padding: 18px;\n        border-radius: 22px;\n        background: #f8fafc;\n        border: 1px solid #edf2f7;\n      }\n\n      .dot {\n        width: 54px;\n        height: 54px;\n        border-radius: 18px;\n        display: grid;\n        place-items: center;\n        color: #fff;\n        font-size: 14px;\n        font-weight: 900;\n        background: linear-gradient(135deg, var(--blue), var(--teal));\n      }\n\n      .timeline-item h3 {\n        margin: 0;\n        font-size: 20px;\n      }\n\n      .timeline-item p {\n        margin: 8px 0 0;\n        color: #5f6d7c;\n        line-height: 1.62;\n        font-size: 14px;\n      }\n\n      .journey-screen {\n        border-radius: 32px;\n        background: #0b1624;\n        padding: 18px;\n        color: #fff;\n        box-shadow: 0 28px 78px rgba(11,22,36,0.25);\n      }\n\n      .screen-head {\n        display: flex;\n        justify-content: space-between;\n        padding: 14px 14px 20px;\n        color: #cbd5e1;\n        font-size: 13px;\n      }\n\n      .pipeline {\n        display: grid;\n        grid-template-columns: repeat(4, 1fr);\n        gap: 12px;\n      }\n\n      .lane {\n        min-height: 410px;\n        border-radius: 22px;\n        background: rgba(255,255,255,0.07);\n        padding: 14px;\n      }\n\n      .lane b {\n        display: block;\n        font-size: 14px;\n        margin-bottom: 14px;\n      }\n\n      .mini-card {\n        border-radius: 16px;\n        padding: 12px;\n        margin-bottom: 10px;\n        background: rgba(255,255,255,0.12);\n        color: #e2e8f0;\n        font-size: 12px;\n        line-height: 1.55;\n      }\n\n      .mini-card.hot {\n        background: linear-gradient(135deg, rgba(198,76,120,0.36), rgba(31,95,229,0.22));\n      }\n\n      .mini-card.hot {\n        position: relative;\n        overflow: hidden;\n      }\n\n      .mini-card.hot::after {\n        content: \"\";\n        position: absolute;\n        inset: 0;\n        background: linear-gradient(110deg, transparent, rgba(255,255,255,0.16), transparent);\n        transform: translateX(-110%);\n      }\n\n      .agents {\n        background: #fff;\n      }\n\n      .agent-grid {\n        display: grid;\n        grid-template-columns: repeat(3, 1fr);\n        gap: 20px;\n      }\n\n      .agent-card {\n        border-radius: 28px;\n        padding: 28px;\n        border: 1px solid var(--line);\n        background: #fbfdff;\n        min-height: 300px;\n      }\n\n      .agent-icon {\n        width: 52px;\n        height: 52px;\n        border-radius: 18px;\n        display: grid;\n        place-items: center;\n        margin-bottom: 38px;\n        color: #fff;\n        font-weight: 900;\n        background: linear-gradient(135deg, var(--rose), var(--blue));\n      }\n\n      .agent-card h3 {\n        margin: 0;\n        font-size: 23px;\n      }\n\n      .agent-card p {\n        margin: 12px 0 0;\n        color: #617083;\n        line-height: 1.68;\n      }\n\n      .agent-card ul {\n        padding: 0;\n        margin: 22px 0 0;\n        list-style: none;\n        display: grid;\n        gap: 9px;\n        color: #405065;\n        font-size: 14px;\n      }\n\n      .agent-card li::before {\n        content: \"✓\";\n        color: var(--teal);\n        font-weight: 900;\n        margin-right: 8px;\n      }\n\n      .case-band {\n        color: #fff;\n        background:\n          linear-gradient(135deg, rgba(11,22,36,0.98), rgba(21,40,64,0.96)),\n          radial-gradient(circle at 80% 20%, rgba(31,95,229,0.34), transparent 30%);\n      }\n\n      .case-band .section-head p,\n      .case-band .kicker { color: #aee9e3; }\n\n      .case-grid {\n        display: grid;\n        grid-template-columns: 0.82fr 1.18fr;\n        gap: 34px;\n      }\n\n      .case-quote {\n        border-radius: 30px;\n        background: rgba(255,255,255,0.08);\n        border: 1px solid rgba(255,255,255,0.12);\n        padding: 34px;\n      }\n\n      .case-quote p {\n        margin: 0;\n        color: #e5edf7;\n        font-size: 22px;\n        line-height: 1.72;\n      }\n\n      .case-quote b {\n        display: block;\n        margin-top: 28px;\n        color: #fff;\n      }\n\n      .case-stats {\n        display: grid;\n        grid-template-columns: repeat(3, 1fr);\n        gap: 16px;\n      }\n\n      .case-stat {\n        border-radius: 26px;\n        background: rgba(255,255,255,0.08);\n        border: 1px solid rgba(255,255,255,0.12);\n        padding: 28px;\n      }\n\n      .case-stat strong {\n        display: block;\n        color: #fff;\n        font-size: 42px;\n      }\n\n      .case-stat span {\n        display: block;\n        margin-top: 10px;\n        color: #cbd5e1;\n        line-height: 1.58;\n      }\n\n      .pricing {\n        background: #fff;\n      }\n\n      .pricing-grid {\n        display: grid;\n        grid-template-columns: repeat(3, 1fr);\n        gap: 20px;\n      }\n\n      .price-card {\n        border: 1px solid var(--line);\n        border-radius: 30px;\n        padding: 30px;\n        background: #fff;\n      }\n\n      .price-card.featured {\n        border-color: rgba(31,95,229,0.34);\n        background: linear-gradient(180deg, #f5f9ff, #fff);\n        box-shadow: 0 24px 68px rgba(31,95,229,0.13);\n      }\n\n      .price-card h3 {\n        margin: 0;\n        font-size: 24px;\n      }\n\n      .price-card p {\n        color: #687482;\n        margin: 10px 0 24px;\n      }\n\n      .price {\n        font-size: 44px;\n        font-weight: 900;\n      }\n\n      .price small {\n        color: #687482;\n        font-size: 16px;\n        font-weight: 600;\n      }\n\n      .price-card ul {\n        list-style: none;\n        padding: 0;\n        margin: 26px 0 0;\n        display: grid;\n        gap: 12px;\n        color: #405065;\n      }\n\n      .price-card li::before {\n        content: \"✓\";\n        color: var(--teal);\n        font-weight: 900;\n        margin-right: 9px;\n      }\n\n      .final-cta {\n        padding: 0 72px 88px;\n        background: #fff;\n      }\n\n      .cta-box {\n        position: relative;\n        overflow: hidden;\n        border-radius: 36px;\n        padding: 48px;\n        color: #fff;\n        background:\n          linear-gradient(135deg, rgba(11,22,36,0.96), rgba(31,95,229,0.9)),\n          radial-gradient(circle at 80% 20%, rgba(10,154,145,0.5), transparent 28%);\n      }\n\n      .cta-box h2 {\n        max-width: 720px;\n        margin: 0;\n        color: #fff;\n      }\n\n      .cta-box p {\n        max-width: 680px;\n        margin: 18px 0 30px;\n        color: #dbeafe;\n        line-height: 1.7;\n        font-size: 18px;\n      }\n\n      .cta-box .primary {\n        display: inline-flex;\n        background: #fff;\n        color: #0b1624;\n        box-shadow: none;\n      }\n\n      @keyframes fadeUp {\n        from { opacity: 0; transform: translateY(22px); }\n        to { opacity: 1; transform: translateY(0); }\n      }\n\n      @keyframes softFloat {\n        0%, 100% { transform: translateY(0); }\n        50% { transform: translateY(-8px); }\n      }\n\n      @keyframes scanGlow {\n        0% { opacity: 0; transform: translateX(-42%); }\n        28% { opacity: 1; }\n        100% { opacity: 0; transform: translateX(42%); }\n      }\n\n      @keyframes hotSweep {\n        0% { transform: translateX(-115%); }\n        100% { transform: translateX(115%); }\n      }\n\n      @keyframes pulseDot {\n        0%, 100% { box-shadow: 0 0 0 0 rgba(199,155,74,0.26); }\n        50% { box-shadow: 0 0 0 8px rgba(199,155,74,0); }\n      }\n\n      .motion-ready .nav,\n      .motion-ready .hero-copy .pill,\n      .motion-ready .hero-copy h1,\n      .motion-ready .hero-copy .lead,\n      .motion-ready .hero-copy .actions,\n      .motion-ready .editor-note,\n      .motion-ready .growth-card,\n      .motion-ready .metrics {\n        opacity: 0;\n        transform: translateY(22px);\n      }\n\n      .motion-ready.is-ready .nav { animation: fadeUp 700ms ease forwards; }\n      .motion-ready.is-ready .hero-copy .pill { animation: fadeUp 700ms ease 90ms forwards; }\n      .motion-ready.is-ready .hero-copy h1 { animation: fadeUp 780ms ease 170ms forwards; }\n      .motion-ready.is-ready .hero-copy .lead { animation: fadeUp 760ms ease 260ms forwards; }\n      .motion-ready.is-ready .hero-copy .actions { animation: fadeUp 740ms ease 350ms forwards; }\n      .motion-ready.is-ready .editor-note { animation: fadeUp 740ms ease 430ms forwards; }\n      .motion-ready.is-ready .growth-card { animation: fadeUp 820ms ease 320ms forwards, softFloat 6s ease-in-out 1.5s infinite; }\n      .motion-ready.is-ready .metrics { animation: fadeUp 760ms ease 540ms forwards; }\n\n      .motion-ready.is-ready .pill::before {\n        animation: pulseDot 2.6s ease-in-out infinite;\n      }\n\n      .motion-ready.is-ready .growth-card::after {\n        animation: scanGlow 3.8s ease 1.2s infinite;\n      }\n\n      .motion-ready .bar i {\n        transform: scaleX(0);\n        transition: transform 1100ms cubic-bezier(.2,.8,.2,1);\n      }\n\n      .motion-ready .is-visible .bar i,\n      .motion-ready .growth-card.is-visible .bar i {\n        transform: scaleX(1);\n      }\n\n      .reveal {\n        opacity: 0;\n        transform: translateY(24px);\n        transition: opacity 680ms ease, transform 680ms ease;\n      }\n\n      .reveal.is-visible {\n        opacity: 1;\n        transform: translateY(0);\n      }\n\n      .motion-ready .diag:nth-child(2),\n      .motion-ready .timeline-item:nth-child(2),\n      .motion-ready .agent-card:nth-child(2),\n      .motion-ready .case-stat:nth-child(2),\n      .motion-ready .price-card:nth-child(2) { transition-delay: 90ms; }\n\n      .motion-ready .diag:nth-child(3),\n      .motion-ready .timeline-item:nth-child(3),\n      .motion-ready .agent-card:nth-child(3),\n      .motion-ready .case-stat:nth-child(3),\n      .motion-ready .price-card:nth-child(3) { transition-delay: 180ms; }\n\n      .motion-ready .diag:nth-child(4),\n      .motion-ready .timeline-item:nth-child(4) { transition-delay: 270ms; }\n\n      .reveal.is-visible .mini-card.hot::after {\n        animation: hotSweep 2.6s ease-in-out infinite;\n      }\n\n      .counting {\n        font-variant-numeric: tabular-nums;\n      }\n\n
      .luxuryRoot.theme-dark {
        --ink: #edf6ff;
        --soft-ink: #c8d7ea;
        --muted: #91a3bb;
        --line: rgba(185, 214, 255, 0.16);
        --blue: #6ea8ff;
        --teal: #42d7c9;
        --rose: #ff7daf;
        --gold: #dfbd70;
        color-scheme: dark;
        color: var(--ink);
        background: radial-gradient(circle at 18% 0%, rgba(66,215,201,0.16), transparent 32%), linear-gradient(180deg, #06111d 0%, #0a1422 48%, #07111d 100%);
      }

      .theme-dark .page,
      .theme-dark .diagnosis,
      .theme-dark .agents,
      .theme-dark .pricing,
      .theme-dark .final-cta {
        background: #07111d;
      }

      .theme-dark .hero {
        background: #06111d;
      }

      .theme-dark .hero-bg {
        opacity: 0.46;
        filter: brightness(0.52) saturate(1.08) contrast(1.08);
      }

      .theme-dark .hero-veil {
        background:
          linear-gradient(90deg, rgba(6,17,29,0.98) 0%, rgba(6,17,29,0.9) 36%, rgba(6,17,29,0.62) 68%, rgba(6,17,29,0.82) 100%),
          radial-gradient(circle at 18% 20%, rgba(66,215,201,0.18), transparent 32%),
          radial-gradient(circle at 70% 18%, rgba(110,168,255,0.2), transparent 35%);
      }

      .theme-dark .brand-logo-day {
        opacity: 0;
      }

      .theme-dark .brand-logo-night {
        opacity: 1;
      }

      .theme-dark .links {
        color: #d5e3f4;
      }

      .theme-dark .nav button,
      .theme-dark .nav .nav-button,
      .theme-dark .nav-button,
      .theme-dark .secondary {
        color: #edf6ff;
        background: rgba(9, 24, 41, 0.62);
        border-color: rgba(185,214,255,0.18);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
      }

      .theme-dark .nav button:hover,
      .theme-dark .nav .nav-button:hover,
      .theme-dark .secondary:hover {
        background: rgba(16, 39, 65, 0.78);
        box-shadow: 0 18px 42px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12);
      }

      .theme-dark .theme-toggle .moon-icon {
        opacity: 0;
        transform: translateY(-16px) rotate(40deg);
      }

      .theme-dark .theme-toggle .sun-icon {
        opacity: 1;
        transform: translateY(0) rotate(0deg);
      }

      .theme-dark .pill,
      .theme-dark .metrics,
      .theme-dark .growth-card,
      .theme-dark .row,
      .theme-dark .advisor-inline,
      .theme-dark .diag,
      .theme-dark .journey-panel,
      .theme-dark .timeline-item,
      .theme-dark .agent-card,
      .theme-dark .price-card {
        background: linear-gradient(180deg, rgba(15, 31, 51, 0.82), rgba(9, 22, 38, 0.68));
        border-color: rgba(185,214,255,0.14);
        box-shadow: 0 26px 70px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06);
      }

      .theme-dark .growth-card {
        border-color: rgba(185,214,255,0.2);
        backdrop-filter: blur(24px);
      }

      .theme-dark .metrics {
        background: rgba(8, 22, 38, 0.72);
        backdrop-filter: blur(20px);
      }

      .theme-dark .metric,
      .theme-dark .case-stat {
        border-color: rgba(185,214,255,0.12);
      }

      .theme-dark .metric span,
      .theme-dark .lead,
      .theme-dark .editor-note,
      .theme-dark .section-head p,
      .theme-dark .diag p,
      .theme-dark .timeline-item p,
      .theme-dark .agent-card p,
      .theme-dark .agent-card ul,
      .theme-dark .price-card p,
      .theme-dark .price-card ul,
      .theme-dark .row-head,
      .theme-dark .advisor-inline p,
      .theme-dark .card-top span,
      .theme-dark .price small {
        color: var(--muted);
      }

      .theme-dark .editor-note b,
      .theme-dark .row-head strong,
      .theme-dark .card-top b,
      .theme-dark .advisor-inline h3,
      .theme-dark .diag h3,
      .theme-dark .timeline-item h3,
      .theme-dark .agent-card h3,
      .theme-dark .price-card h3,
      .theme-dark .price,
      .theme-dark .metric strong {
        color: var(--ink);
      }

      .theme-dark .journey {
        background: linear-gradient(180deg, #081522 0%, #07111d 100%);
      }

      .theme-dark .journey-screen,
      .theme-dark .case-band,
      .theme-dark .cta-box {
        background:
          radial-gradient(circle at 76% 22%, rgba(66,215,201,0.18), transparent 28%),
          linear-gradient(135deg, rgba(5,14,26,0.98), rgba(13,29,49,0.98));
        border: 1px solid rgba(185,214,255,0.12);
        box-shadow: 0 30px 86px rgba(0,0,0,0.32);
      }

      .theme-dark .lane,
      .theme-dark .mini-card,
      .theme-dark .case-quote,
      .theme-dark .case-stat {
        background: rgba(255,255,255,0.07);
        border-color: rgba(255,255,255,0.12);
      }

      .theme-dark .bar {
        background: rgba(203, 213, 225, 0.14);
      }

      .theme-dark .price-card.featured {
        border-color: rgba(110,168,255,0.42);
        background: linear-gradient(180deg, rgba(23, 52, 88, 0.76), rgba(9,22,38,0.74));
        box-shadow: 0 26px 76px rgba(31,95,229,0.22);
      }

      .theme-dark .badge,
      .theme-dark .confidence {
        color: #9ff5ea;
        background: rgba(66,215,201,0.13);
      }

      .theme-dark .chips span {
        color: #bcd7ff;
        background: rgba(110,168,255,0.12);
      }

      @media (prefers-reduced-motion: reduce) {\n        *,\n        *::before,\n        *::after {\n          animation-duration: 1ms !important;\n          animation-iteration-count: 1 !important;\n          scroll-behavior: auto !important;\n          transition-duration: 1ms !important;\n        }\n\n        .motion-ready .nav,\n        .motion-ready .hero-copy .pill,\n        .motion-ready .hero-copy h1,\n        .motion-ready .hero-copy .lead,\n        .motion-ready .hero-copy .actions,\n        .motion-ready .editor-note,\n        .motion-ready .growth-card,\n        .motion-ready .metrics,\n        .reveal {\n          opacity: 1;\n          transform: none;\n        }\n\n        .motion-ready .bar i {\n          transform: none;\n        }\n      }\n\n      @media (max-width: 980px) {\n        .hero {\n          display: flex;\n          flex-direction: column;\n          min-height: auto;\n          padding-bottom: 34px;\n        }\n\n        .hero-bg {\n          object-position: 62% center;\n        }\n\n        .hero-veil {\n          background:\n            linear-gradient(180deg, rgba(250,247,241,0.96) 0%, rgba(250,247,241,0.74) 48%, rgba(250,247,241,0.9) 100%);\n        }\n\n        .nav {\n          order: 0;\n          height: auto;\n          padding: 18px 22px;\n          gap: 14px;\n        }\n\n        .nav-actions {\n          gap: 10px;\n        }\n\n        .theme-toggle {\n          width: 42px;\n          height: 42px;\n        }\n\n        .links {\n          display: none;\n        }\n\n        .mark {\n          width: 42px;\n          height: 42px;\n        }\n\n        .brand strong {\n          font-size: 17px;\n        }\n\n        .brand span {\n          font-size: 11px;\n          line-height: 1.35;\n        }\n\n        .brand-logo-stack {\n          width: 220px;\n          height: 50px;\n        }\n\n        .brand-logo-img {\n          height: 50px;\n          max-width: 220px;\n        }\n\n        .nav button, .nav .nav-button, .nav-button {\n          padding: 11px 15px;\n          font-size: 13px;\n        }\n\n        .hero-copy {\n          order: 1;\n          width: auto;\n          padding: 32px 22px 0;\n        }\n\n        .pill {\n          max-width: 100%;\n          font-size: 13px;\n          line-height: 1.45;\n        }\n\n        h1 {\n          margin: 24px 0 18px;\n          font-size: 46px;\n          line-height: 1.12;\n        }\n\n        .lead {\n          width: auto;\n          font-size: 17px;\n          line-height: 1.66;\n        }\n\n        .actions {\n          flex-wrap: wrap;\n          margin-top: 24px;\n        }\n\n        .primary,\n        .secondary {\n          padding: 15px 19px;\n          font-size: 15px;\n        }\n\n        .editor-note {\n          width: auto;\n          margin-top: 28px;\n          font-size: 14px;\n          line-height: 1.68;\n        }\n\n        .card-top {\n          align-items: flex-start;\n        }\n\n        .growth-card {\n          order: 2;\n          position: relative;\n          right: auto;\n          top: auto;\n          width: calc(100% - 36px);\n          margin: 28px auto 0;\n          padding: 18px;\n          border-radius: 28px;\n        }\n\n        .card-top {\n          margin-bottom: 18px;\n        }\n\n        .funnel {\n          gap: 10px;\n        }\n\n        .row {\n          padding: 12px;\n          border-radius: 16px;\n        }\n\n        .row-head {\n          margin-bottom: 8px;\n        }\n\n        .advisor-inline {\n          margin-top: 14px;\n          padding: 16px;\n          border-radius: 20px;\n        }\n\n        .insight-head {\n          align-items: flex-start;\n        }\n\n        .confidence {\n          white-space: nowrap;\n        }\n\n        .metrics {\n          order: 3;\n          position: relative;\n          left: auto;\n          bottom: auto;\n          width: calc(100% - 36px);\n          margin: 18px auto 0;\n          grid-template-columns: repeat(2, 1fr);\n          border-radius: 22px;\n        }\n\n        .metric {\n          padding: 17px 16px;\n        }\n\n        section.band,\n        .final-cta {\n          padding: 60px 22px;\n        }\n\n        .section-head,\n        .journey-layout,\n        .diagnosis-grid,\n        .agent-grid,\n        .case-grid,\n        .case-stats,\n        .pricing-grid {\n          grid-template-columns: 1fr;\n        }\n\n        .section-head {\n          gap: 20px;\n        }\n\n        h2 {\n          font-size: 34px;\n          line-height: 1.26;\n        }\n\n        .section-head {\n          margin-bottom: 34px;\n        }\n\n        .diag {\n          min-height: auto;\n          padding: 24px;\n          border-radius: 24px;\n        }\n\n        .diag .num {\n          margin-bottom: 34px;\n        }\n\n        .agent-card {\n          min-height: auto;\n          padding: 26px;\n          border-radius: 24px;\n        }\n\n        .agent-icon {\n          margin-bottom: 32px;\n        }\n\n        .case-quote,\n        .case-stat {\n          border-radius: 24px;\n          padding: 26px;\n        }\n\n        .case-quote p {\n          font-size: 20px;\n          line-height: 1.7;\n        }\n\n        .price-card {\n          min-height: auto;\n        }\n\n        .pipeline {\n          grid-template-columns: 1fr;\n        }\n\n        .lane {\n          min-height: auto;\n        }\n\n        .cta-box {\n          padding: 32px 24px;\n          border-radius: 28px;\n        }\n      }\n\n      @media (max-width: 560px) {\n        .brand {\n          gap: 10px;\n        }\n\n        .brand-logo-stack {\n          width: 202px;\n          height: 46px;\n        }\n\n        .brand-logo-img {\n          height: 46px;\n          max-width: 202px;\n        }\n\n        .nav {\n          align-items: flex-start;\n        }\n\n        .nav button, .nav .nav-button, .nav-button {\n          padding: 10px 12px;\n        }\n\n        .theme-toggle {\n          width: 40px;\n          height: 40px;\n        }\n\n        h1 {\n          font-size: 38px;\n        }\n\n        h1 em {\n          margin-top: 4px;\n        }\n\n        .pill {\n          padding: 8px 12px;\n          font-size: 12px;\n        }\n\n        .primary,\n        .secondary {\n          padding: 13px 16px;\n          font-size: 14px;\n        }\n\n        .editor-note {\n          margin-top: 24px;\n        }\n\n        .card-top {\n          display: flex;\n          align-items: flex-start;\n        }\n\n        .card-top b {\n          font-size: 20px;\n        }\n\n        .card-top span {\n          font-size: 12px;\n        }\n\n        .badge {\n          padding: 7px 10px;\n          white-space: nowrap;\n        }\n\n        .insight-head {\n          display: grid;\n          gap: 12px;\n        }\n\n        .ai-dot {\n          width: 32px;\n          height: 32px;\n          border-radius: 11px;\n        }\n\n        .confidence {\n          justify-self: start;\n          padding: 5px 8px;\n        }\n\n        .chips span {\n          font-size: 11px;\n        }\n\n        .metric strong {\n          font-size: 23px;\n        }\n\n        .metric span {\n          font-size: 12px;\n        }\n\n        .journey-panel,\n        .journey-screen,\n        .price-card {\n          border-radius: 24px;\n          padding: 22px;\n        }\n\n        .timeline-item {\n          grid-template-columns: 44px 1fr;\n          gap: 13px;\n        }\n\n        .dot {\n          width: 44px;\n          height: 44px;\n          border-radius: 15px;\n        }\n\n        .agent-grid,\n        .diagnosis-grid,\n        .pricing-grid,\n        .case-stats {\n          gap: 16px;\n        }\n\n        .cta-box h2 {\n          font-size: 31px;\n          line-height: 1.24;\n        }\n      }\n    `;
const homepageFooterCss = `
      .site-footer {
        padding: 62px 72px 54px;
        color: #546172;
        background: linear-gradient(180deg, #ffffff 0%, #f7fbfd 100%);
        border-top: 1px solid var(--line);
      }

      .footer-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
        gap: 36px;
        align-items: start;
      }

      .footer-brand strong {
        display: block;
        color: var(--ink);
        font-size: 24px;
      }

      .footer-brand p {
        max-width: 620px;
        margin: 14px 0 0;
        font-size: 15px;
        line-height: 1.72;
      }

      .footer-contact,
      .footer-records {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 18px;
        margin-top: 18px;
        font-size: 13px;
      }

      .footer-records a {
        color: #1f5fe5;
        font-weight: 800;
        text-decoration: none;
      }

      .footer-qrs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .footer-qr {
        display: grid;
        grid-template-columns: 82px 1fr;
        gap: 14px;
        align-items: center;
        padding: 14px;
        border-radius: 22px;
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(11,22,36,0.08);
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
      }

      .footer-qr img {
        width: 82px;
        height: 82px;
        border-radius: 16px;
        object-fit: cover;
        background: #fff;
        border: 1px solid rgba(11,22,36,0.08);
      }

      .footer-qr span {
        display: block;
        color: var(--ink);
        font-size: 14px;
        font-weight: 900;
      }

      .footer-qr small {
        display: block;
        margin-top: 6px;
        color: #728095;
        line-height: 1.5;
      }

      .theme-dark .site-footer {
        color: var(--muted);
        background: linear-gradient(180deg, #07111d 0%, #081522 100%);
        border-top-color: rgba(185,214,255,0.12);
      }

      .theme-dark .footer-brand strong,
      .theme-dark .footer-qr span {
        color: var(--ink);
      }

      .theme-dark .footer-qr {
        background: rgba(255,255,255,0.07);
        border-color: rgba(255,255,255,0.12);
        box-shadow: 0 24px 70px rgba(0,0,0,0.18);
      }

      @media (max-width: 980px) {
        .site-footer {
          padding: 54px 22px 48px;
        }

        .footer-grid,
        .footer-qrs {
          grid-template-columns: 1fr;
        }
      }
    `;

const homepagePreviewBridgeScript = `
      (() => {
        const targets = [
          ['hero', '.hero-copy, .metrics, .growth-card'],
          ['navigation', '.nav'],
          ['brand', '.brand-logo-stack'],
          ['heroPrimaryAction', '[data-edit-target="heroPrimaryAction"]'],
          ['heroImage', '.hero-bg, .hero-veil'],
          ['metricConversionRate', '[data-edit-target="metricConversionRate"]'],
          ['diagnosisSection', '[data-edit-target="diagnosisSection"]'],
          ['journeySection', '[data-edit-target="journeySection"]'],
          ['agentSection', '[data-edit-target="agentSection"]'],
          ['caseSection', '[data-edit-target="caseSection"]'],
          ['pricingSection', '[data-edit-target="pricingSection"]'],
          ['finalCta', '[data-edit-target="finalCta"]'],
          ['footer', '.site-footer'],
          ['wechatQr', '.footer-qr:first-child'],
          ['miniProgramQr', '.footer-qr:nth-child(2)'],
        ];
        const clickTargets = [
          ['heroPrimaryAction', '[data-edit-target="heroPrimaryAction"]'],
          ['brand', '.brand-logo-stack'],
          ['wechatQr', '.footer-qr:first-child'],
          ['miniProgramQr', '.footer-qr:nth-child(2)'],
          ['metricConversionRate', '[data-edit-target="metricConversionRate"]'],
          ['diagnosisSection', '[data-edit-target="diagnosisSection"]'],
          ['journeySection', '[data-edit-target="journeySection"]'],
          ['agentSection', '[data-edit-target="agentSection"]'],
          ['caseSection', '[data-edit-target="caseSection"]'],
          ['pricingSection', '[data-edit-target="pricingSection"]'],
          ['finalCta', '[data-edit-target="finalCta"]'],
          ['hero', '.hero-copy, .metrics, .growth-card'],
          ['navigation', '.nav'],
          ['footer', '.site-footer'],
          ['heroImage', '.hero-bg, .hero-veil, .hero'],
        ];

        const findTarget = (targetName) => {
          const target = targets.find(([name]) => name === targetName);
          return target ? document.querySelector(target[1]) : null;
        };

        targets.forEach(([, selector]) => {
          document.querySelectorAll(selector).forEach((element) => {
            element.classList.add('homepage-preview-editable');
          });
        });

        window.addEventListener('message', (event) => {
          const data = event.data;
          if (!data || typeof data !== 'object') return;
          if (data.type !== 'homepage-preview-scroll') return;

          const element = findTarget(data.target);
          if (!element) return;

          document.querySelectorAll('.homepage-preview-selected').forEach((selected) => {
            selected.classList.remove('homepage-preview-selected');
          });
          element.classList.add('homepage-preview-selected');
          element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        });

        document.addEventListener('click', (event) => {
          const element = event.target instanceof Element ? event.target : null;
          if (!element) return;
          const explicitTarget = element.closest('[data-edit-target]')?.getAttribute('data-edit-target');
          const target = explicitTarget
            ? clickTargets.find(([name]) => name === explicitTarget)
            : clickTargets.find(([, selector]) => element.closest(selector));
          if (!target) {
            window.parent.postMessage({ type: 'homepage-preview-target-unavailable' }, '*');
            return;
          }
          event.preventDefault();
          window.parent.postMessage({ type: 'homepage-preview-target', target: target[0] }, '*');
        });
      })();
    `;

const luxuryMarkup = `<div class=\"page\">\n      <section class=\"hero\">\n        <img class=\"hero-bg\" src=\"/homepage/zmtg-luxury-clinic-bg.png\" alt=\"\" />\n        <div class=\"hero-veil\"></div>\n\n        <nav class=\"nav\">\n          <div class=\"brand\">\n            <span class=\"brand-logo-stack\" aria-label=\"智美天工 ZHIMEI TIANGONG\">\n              <img class=\"brand-logo-img brand-logo-day\" src=\"/brand/zmtg-logo-horizontal-luxury-clean.png\" alt=\"\" />\n              <img class=\"brand-logo-img brand-logo-night\" src=\"/brand/zmtg-logo-horizontal-night-clean.png\" alt=\"\" />\n            </span>\n          </div>\n          <div class=\"links\">\n            <a href=\"#diagnosis\">增长诊断</a>\n            <a href=\"#agents\">智能体方案</a>\n            <a href=\"#journey\">客户旅程</a>\n            <a href=\"#cases\">案例数据</a>\n          </div>\n          <div class=\"nav-actions\">
            <button class=\"theme-toggle\" type=\"button\" aria-label=\"切换夜间模式\" title=\"切换夜间模式\"><span class=\"moon-icon\" aria-hidden=\"true\">☾</span><span class=\"sun-icon\" aria-hidden=\"true\">☀</span><span class=\"theme-toggle-label\">夜间模式</span></button>
            <a class=\"nav-button\" href=\"/login\">预约演示</a>
          </div>\n        </nav>\n\n        <div class=\"hero-copy\">\n          <div class=\"pill\">智美天工 · 医美 AI 增长操作系统</div>\n          <h1><span>让医美经营</span><em>更懂每位客户</em></h1>\n          <p class=\"lead\">\n            用 AI 智能体识别高意向客户、推荐跟进节奏、编排术后关怀与复购召回，\n            让咨询师从处理消息，升级为经营长期客户关系。\n          </p>\n          <div class=\"actions\">\n            <a class=\"button primary\" href=\"/login\">预约增长诊断 →</a>\n            <a class=\"button secondary\" href=\"#journey\">查看客户旅程</a>\n          </div>\n          <div class=\"editor-note\">\n            <b>7 天跑通核心旅程：</b>新客咨询、到院提醒、术后关怀、复购召回，先让增长动作持续发生。\n          </div>\n        </div>\n\n        <div class=\"metrics\">\n          <div class=\"metric\"><strong>35%</strong><span>复购率提升案例</span></div>\n          <div class=\"metric\"><strong>2.4x</strong><span>咨询响应效率</span></div>\n          <div class=\"metric\"><strong>7×24</strong><span>智能体持续接待</span></div>\n          <div class=\"metric\"><strong>4步</strong><span>上线核心旅程</span></div>\n        </div>\n\n        <aside class=\"growth-card\">\n          <div class=\"card-top\">\n            <div><b>今日增长机会</b><span>AI 已为咨询团队排好优先级</span></div>\n            <div class=\"badge\">运行中</div>\n          </div>\n          <div class=\"funnel\">\n            <div class=\"row\"><div class=\"row-head\"><span>新增咨询</span><strong>1,284</strong></div><div class=\"bar\"><i style=\"width:92%;background:var(--blue);\"></i></div></div>\n            <div class=\"row\"><div class=\"row-head\"><span>AI 已承接</span><strong>916</strong></div><div class=\"bar\"><i style=\"width:74%;background:var(--teal);\"></i></div></div>\n            <div class=\"row\"><div class=\"row-head\"><span>高意向转人工</span><strong>216</strong></div><div class=\"bar\"><i style=\"width:48%;background:var(--rose);\"></i></div></div>\n            <div class=\"row\"><div class=\"row-head\"><span>预约到院</span><strong>88</strong></div><div class=\"bar\"><i style=\"width:34%;background:var(--gold);\"></i></div></div>\n          </div>\n          <div class=\"advisor-inline\">\n            <div class=\"insight-head\">\n              <div class=\"insight-title\">\n                <div class=\"ai-dot\">AI</div>\n                <div>\n                  <small>下一步建议</small>\n                  <h3>优先承接 18 位复购窗口客户</h3>\n                </div>\n              </div>\n              <span class=\"confidence\">92%匹配</span>\n            </div>\n            <p>她们处于术后第 21-30 天，近期咨询补水与修复项目，建议由资深咨询师人工跟进。</p>\n            <div class=\"chips\"><span>高意向</span><span>复购窗口</span><span>需人工承接</span></div>\n          </div>\n        </aside>\n      </section>\n\n      <section id=\"diagnosis\" class=\"band diagnosis\">\n        <div class=\"section-head\">\n          <div>\n            <div class=\"kicker\">GROWTH DIAGNOSIS</div>\n            <h2>先诊断增长断点，再配置智能体</h2>\n          </div>\n          <p>页面不再堆功能，而是把机构最关心的经营问题拆成四个可被 AI 协同解决的环节。</p>\n        </div>\n        <div class=\"diagnosis-grid\">\n          <div class=\"diag\"><div class=\"num\">01</div><h3>客户资产分散</h3><p>客户记录、项目偏好和跟进状态散落在不同账号和表格，团队无法统一复盘。</p></div>\n          <div class=\"diag\"><div class=\"num\">02</div><h3>咨询承接不稳定</h3><p>新客咨询高峰期容易漏回，资深咨询师时间被低意向客户消耗。</p></div>\n          <div class=\"diag\"><div class=\"num\">03</div><h3>术后关怀难坚持</h3><p>术后提醒、恢复反馈和复诊邀约靠人工记忆，服务标准难复制。</p></div>\n          <div class=\"diag\"><div class=\"num\">04</div><h3>复购机会不可见</h3><p>客户进入补水、修复、抗衰等复购窗口时，系统没有及时提醒团队承接。</p></div>\n        </div>\n      </section>\n\n      <section id=\"journey\" class=\"band journey\">\n        <div class=\"section-head\">\n          <div>\n            <div class=\"kicker\">CUSTOMER JOURNEY</div>\n            <h2>把医美客户旅程做成可运营资产</h2>\n          </div>\n          <p>从咨询、到院、术后到复购，每个节点都可以由智能体提示、触达、转人工和复盘。</p>\n        </div>\n        <div class=\"journey-layout\">\n          <div class=\"journey-panel\">\n            <div class=\"timeline\">\n              <div class=\"timeline-item\"><div class=\"dot\">1</div><div><h3>新客咨询</h3><p>AI 接待基础问题，识别高意向、禁忌风险和价格异议。</p></div></div>\n              <div class=\"timeline-item\"><div class=\"dot\">2</div><div><h3>预约到院</h3><p>提醒到院时间、术前注意事项，并把关键诉求同步给咨询师。</p></div></div>\n              <div class=\"timeline-item\"><div class=\"dot\">3</div><div><h3>术后关怀</h3><p>按项目自动发送护理提醒，异常反馈及时转人工。</p></div></div>\n              <div class=\"timeline-item\"><div class=\"dot\">4</div><div><h3>复购召回</h3><p>根据恢复周期和历史偏好，提示适合承接的复购窗口。</p></div></div>\n            </div>\n          </div>\n          <div class=\"journey-screen\">\n            <div class=\"screen-head\"><span>智美天工 · 旅程运营看板</span><span>本周 216 个高意向机会</span></div>\n            <div class=\"pipeline\">\n              <div class=\"lane\"><b>新客咨询</b><div class=\"mini-card hot\">玻尿酸价格咨询<br />AI 建议：转人工</div><div class=\"mini-card\">热玛吉恢复期问题</div><div class=\"mini-card\">水光针禁忌咨询</div></div>\n              <div class=\"lane\"><b>到院邀约</b><div class=\"mini-card\">明日到院提醒</div><div class=\"mini-card hot\">高预算客户确认档期</div><div class=\"mini-card\">术前注意事项</div></div>\n              <div class=\"lane\"><b>术后关怀</b><div class=\"mini-card\">第 3 天红肿反馈</div><div class=\"mini-card\">第 7 天复诊提醒</div><div class=\"mini-card hot\">异常症状转人工</div></div>\n              <div class=\"lane\"><b>复购召回</b><div class=\"mini-card hot\">补水修复窗口</div><div class=\"mini-card\">抗衰项目推荐</div><div class=\"mini-card\">会员生日关怀</div></div>\n            </div>\n          </div>\n        </div>\n      </section>\n\n      <section id=\"agents\" class=\"band agents\">\n        <div class=\"section-head\">\n          <div>\n            <div class=\"kicker\">AI AGENTS</div>\n            <h2>不是一个客服机器人，而是一组医美增长智能体</h2>\n          </div>\n          <p>每个智能体负责一个经营场景，并遵守医美合规话术边界。</p>\n        </div>\n        <div class=\"agent-grid\">\n          <div class=\"agent-card\"><div class=\"agent-icon\">咨</div><h3>咨询转化智能体</h3><p>辅助接待新客，提炼需求，识别高意向并提示人工承接。</p><ul><li>项目知识问答</li><li>价格异议处理</li><li>风险话术提醒</li></ul></div>\n          <div class=\"agent-card\"><div class=\"agent-icon\">护</div><h3>术后关怀智能体</h3><p>根据项目周期自动发送护理提醒，收集恢复反馈并识别异常。</p><ul><li>护理 SOP 触达</li><li>复诊提醒</li><li>异常转人工</li></ul></div>\n          <div class=\"agent-card\"><div class=\"agent-icon\">营</div><h3>复购增长智能体</h3><p>结合客户偏好、恢复阶段和历史项目，发现适合跟进的增长机会。</p><ul><li>复购窗口识别</li><li>人群分层</li><li>召回话术建议</li></ul></div>\n        </div>\n      </section>\n\n      <section id=\"cases\" class=\"band case-band\">\n        <div class=\"section-head\">\n          <div>\n            <div class=\"kicker\">RESULTS</div>\n            <h2>让经营结果看得见</h2>\n          </div>\n          <p>比“用了 AI”更重要的是：客户有没有被及时承接，服务有没有持续发生，复购有没有被唤醒。</p>\n        </div>\n        <div class=\"case-grid\">\n          <div class=\"case-quote\">\n            <p>“上线后，咨询师每天打开系统先看高意向客户和复购窗口，不再靠人工翻聊天记录。术后关怀稳定了，客户体验也更一致。”</p>\n            <b>某连锁医美机构 · 运营总监</b>\n          </div>\n          <div class=\"case-stats\">\n            <div class=\"case-stat\"><strong>35%</strong><span>复购率提升</span></div>\n            <div class=\"case-stat\"><strong>2.4x</strong><span>咨询响应效率</span></div>\n            <div class=\"case-stat\"><strong>40%</strong><span>客诉风险下降</span></div>\n          </div>\n        </div>\n      </section>\n\n      <section id=\"pricing\" class=\"band pricing\">\n        <div class=\"section-head\">\n          <div>\n            <div class=\"kicker\">PLANS</div>\n            <h2>按机构阶段选择增长方案</h2>\n          </div>\n          <p>试用版先验证一条核心客户旅程，专业版跑通单店增长，企业版复制到多门店。</p>\n        </div>\n        <div class=\"pricing-grid\">\n          <div class=\"price-card\"><h3>试用版</h3><p>验证核心旅程</p><div class=\"price\">¥0 <small>/14天</small></div><ul><li>客户管理基础功能</li><li>AI 咨询助手</li><li>3 条随访旅程</li><li>基础数据分析</li></ul></div>\n          <div class=\"price-card featured\"><h3>专业版</h3><p>适合单店和成长期机构</p><div class=\"price\">¥2,999 <small>/月</small></div><ul><li>无限随访旅程</li><li>企业微信客户同步</li><li>AI 优先响应</li><li>营销自动化与数据导出</li></ul></div>\n          <div class=\"price-card\"><h3>企业版</h3><p>适合连锁机构</p><div class=\"price\">¥7,999 <small>/月</small></div><ul><li>多门店统一管理</li><li>专属成功经理</li><li>高级数据分析</li><li>私有化与定制方案</li></ul></div>\n        </div>\n      </section>\n\n      <section class=\"final-cta\">\n        <div class=\"cta-box\">\n          <h2>先从一条客户旅程开始，看到 AI 带来的真实增长</h2>\n          <p>我们会帮机构梳理咨询、到院、术后和复购四个关键节点，先配置一条可运行的增长旅程，再逐步扩展到完整智能运营中台。</p>\n          <a class=\"button primary\" href=\"/login\">预约增长诊断 →</a>\n        </div>\n      </section>\n    </div>`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replaceFirst(source: string, pattern: RegExp, replacement: string) {
  return source.replace(pattern, replacement);
}

function navLinksMarkup(config: HomepageBrandConfig) {
  return config.navigation.links
    .filter((link) => link.visible)
    .map((link) => `<a href=\"${escapeHtml(link.href)}\">${escapeHtml(link.label)}</a>`)
    .join('\n            ');
}

function metricsMarkup(config: HomepageBrandConfig) {
  return config.metrics
    .filter((metric) => metric.visible)
    .map((metric) => `<div class=\"metric\"><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></div>`)
    .join('\n          ');
}

function growthRowsMarkup(config: HomepageBrandConfig) {
  const colorByTone = {
    blue: 'var(--blue)',
    teal: 'var(--teal)',
    rose: 'var(--rose)',
    gold: 'var(--gold)',
  } as const;

  return config.growthCard.rows
    .map((row) => `<div class=\"row\"><div class=\"row-head\"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div><div class=\"bar\"><i style=\"width:${row.percent}%;background:${colorByTone[row.tone]};\"></i></div></div>`)
    .join('\n            ');
}

function sectionHeadMarkup(section: { kicker: string; title: string; description: string }) {
  return `<div class=\"section-head\">
          <div>
            <div class=\"kicker\">${escapeHtml(section.kicker)}</div>
            <h2>${escapeHtml(section.title)}</h2>
          </div>
          <p>${escapeHtml(section.description)}</p>
        </div>`;
}

function diagnosisSectionMarkup(config: HomepageBrandConfig) {
  const section = config.sections.diagnosis;
  const cards = section.cards
    .map((card) => `<div class=\"diag\"><div class=\"num\">${escapeHtml(card.marker ?? '')}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.description)}</p></div>`)
    .join('\n          ');

  return `<section id=\"diagnosis\" class=\"band diagnosis\">
        ${sectionHeadMarkup(section)}
        <div class=\"diagnosis-grid\">
          ${cards}
        </div>
      </section>`;
}

function journeySectionMarkup(config: HomepageBrandConfig) {
  const section = config.sections.journey;
  const steps = section.cards
    .map((card) => `<div class=\"timeline-item\"><div class=\"dot\">${escapeHtml(card.marker ?? '')}</div><div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.description)}</p></div></div>`)
    .join('\n              ');
  const lanes = section.lanes
    .map((lane) => `<div class=\"lane\"><b>${escapeHtml(lane.title)}</b>${lane.cards.map((card) => `<div class=\"mini-card${card.hot ? ' hot' : ''}\">${escapeHtml(card.title)}${card.description ? `<br />${escapeHtml(card.description)}` : ''}</div>`).join('')}</div>`)
    .join('\n              ');

  return `<section id=\"journey\" class=\"band journey\">
        ${sectionHeadMarkup(section)}
        <div class=\"journey-layout\">
          <div class=\"journey-panel\">
            <div class=\"timeline\">
              ${steps}
            </div>
          </div>
          <div class=\"journey-screen\">
            <div class=\"screen-head\"><span>${escapeHtml(section.boardTitle)}</span><span>${escapeHtml(section.boardSummary)}</span></div>
            <div class=\"pipeline\">
              ${lanes}
            </div>
          </div>
        </div>
      </section>`;
}

function agentSectionMarkup(config: HomepageBrandConfig) {
  const section = config.sections.agents;
  const cards = section.cards
    .map((card) => `<div class=\"agent-card\"><div class=\"agent-icon\">${escapeHtml(card.icon ?? '')}</div><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.description)}</p><ul>${(card.items ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`)
    .join('\n          ');

  return `<section id=\"agents\" class=\"band agents\">
        ${sectionHeadMarkup(section)}
        <div class=\"agent-grid\">
          ${cards}
        </div>
      </section>`;
}

function caseSectionMarkup(config: HomepageBrandConfig) {
  const section = config.sections.cases;
  const stats = section.stats
    .map((stat) => `<div class=\"case-stat\"><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.label)}</span></div>`)
    .join('\n            ');

  return `<section id=\"cases\" class=\"band case-band\">
        ${sectionHeadMarkup(section)}
        <div class=\"case-grid\">
          <div class=\"case-quote\">
            <p>${escapeHtml(section.quote)}</p>
            <b>${escapeHtml(section.author)}</b>
          </div>
          <div class=\"case-stats\">
            ${stats}
          </div>
        </div>
      </section>`;
}

function pricingSectionMarkup(config: HomepageBrandConfig) {
  const section = config.sections.pricing;
  const plans = section.plans
    .map((plan) => `<div class=\"price-card${plan.featured ? ' featured' : ''}\"><h3>${escapeHtml(plan.title)}</h3><p>${escapeHtml(plan.description)}</p><div class=\"price\">${escapeHtml(plan.price)} <small>${escapeHtml(plan.period)}</small></div><ul>${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul></div>`)
    .join('\n          ');

  return `<section id=\"pricing\" class=\"band pricing\">
        ${sectionHeadMarkup(section)}
        <div class=\"pricing-grid\">
          ${plans}
        </div>
      </section>`;
}

function finalCtaSectionMarkup(config: HomepageBrandConfig) {
  const section = config.sections.finalCta;

  return `<section class=\"final-cta\">
        <div class=\"cta-box\">
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.description)}</p>
          <a class=\"button primary\" href=\"${escapeHtml(section.action.href)}\">${escapeHtml(section.action.label)}</a>
        </div>
      </section>`;
}

function homepageFooterMarkup(config: HomepageBrandConfig) {
  const footer = config.footer;

  return `<footer class=\"site-footer\" aria-label=\"网站页脚\">
        <div class=\"footer-grid\">
          <div class=\"footer-brand\">
            <strong>${escapeHtml(footer.companyName)}</strong>
            <p>${escapeHtml(config.metadata.seoDescription || config.metadata.description)}</p>
            <div class=\"footer-contact\">
              <span>联系电话：<b>${escapeHtml(footer.phone)}</b></span>
              <span>邮箱：<b>${escapeHtml(footer.email)}</b></span>
            </div>
            <div class=\"footer-records\">
              <a href=\"${escapeHtml(footer.icpUrl)}\" target=\"_blank\" rel=\"noreferrer\">${escapeHtml(footer.icpNumber)}</a>
              <a href=\"${escapeHtml(footer.policeUrl)}\" target=\"_blank\" rel=\"noreferrer\">${escapeHtml(footer.policeNumber)}</a>
            </div>
          </div>
          <div class=\"footer-qrs\">
            <div class=\"footer-qr\"><img src=\"${escapeHtml(footer.wechatQrUrl)}\" alt=\"公众号二维码\" /><div><span>公众号二维码</span><small>关注品牌动态与运营案例</small></div></div>
            <div class=\"footer-qr\"><img src=\"${escapeHtml(footer.miniProgramQrUrl)}\" alt=\"小程序二维码\" /><div><span>小程序二维码</span><small>移动端查看服务入口</small></div></div>
          </div>
        </div>
      </footer>`;
}

function withPreviewEditTargets(markup: string) {
  return markup
    .replace('<section class="hero">', '<section class="hero" data-edit-target="heroImage">')
    .replace('<img class="hero-bg"', '<img class="hero-bg" data-edit-target="heroImage"')
    .replace('<div class="hero-veil">', '<div class="hero-veil" data-edit-target="heroImage">')
    .replace('<nav class="nav">', '<nav class="nav" data-edit-target="navigation">')
    .replace('<span class="brand-logo-stack"', '<span class="brand-logo-stack" data-edit-target="brand"')
    .replace('<a class="nav-button"', '<a class="nav-button" data-edit-target="navigation"')
    .replace('<div class="hero-copy">', '<div class="hero-copy" data-edit-target="hero">')
    .replace('<div class="pill">', '<div class="pill" data-edit-target="hero">')
    .replace('<h1>', '<h1 data-edit-target="hero">')
    .replace('<p class="lead">', '<p class="lead" data-edit-target="hero">')
    .replace('<div class="actions">', '<div class="actions" data-edit-target="heroPrimaryAction">')
    .replace('<div class="editor-note">', '<div class="editor-note" data-edit-target="hero">')
    .replace('<div class="metrics">', '<div class="metrics" data-edit-target="metricConversionRate">')
    .replace('<aside class="growth-card">', '<aside class="growth-card" data-edit-target="metricConversionRate">')
    .replace('<section id="diagnosis" class="band diagnosis">', '<section id="diagnosis" class="band diagnosis" data-edit-target="diagnosisSection">')
    .replace('<section id="journey" class="band journey">', '<section id="journey" class="band journey" data-edit-target="journeySection">')
    .replace('<section id="agents" class="band agents">', '<section id="agents" class="band agents" data-edit-target="agentSection">')
    .replace('<section id="cases" class="band case-band">', '<section id="cases" class="band case-band" data-edit-target="caseSection">')
    .replace('<section id="pricing" class="band pricing">', '<section id="pricing" class="band pricing" data-edit-target="pricingSection">')
    .replace('<section class="final-cta">', '<section class="final-cta" data-edit-target="finalCta">')
    .replace('<footer class="site-footer"', '<footer class="site-footer" data-edit-target="footer"')
    .replace('<div class="footer-qr"><img', '<div class="footer-qr" data-edit-target="wechatQr"><img')
    .replace('<div class="footer-qr"><img', '<div class="footer-qr" data-edit-target="miniProgramQr"><img');
}

export function buildMarketingHomeMarkup(config: HomepageBrandConfig = defaultHomepageBrandConfig) {
  let markup = luxuryMarkup
    .replace('/homepage/zmtg-luxury-clinic-bg.png', escapeHtml(config.assets.heroBackgroundUrl))
    .replace('/brand/zmtg-logo-horizontal-luxury-clean.png', escapeHtml(config.assets.horizontalLogoUrl))
    .replace('/brand/zmtg-logo-horizontal-night-clean.png', escapeHtml(config.assets.horizontalLogoNightUrl))
    .replace('智美天工 · 医美 AI 增长操作系统', escapeHtml(config.hero.eyebrow))
    .replace('<span>让医美经营</span><em>更懂每位客户</em>', `<span>${escapeHtml(config.hero.titleLine)}</span><em>${escapeHtml(config.hero.accentLine)}</em>`)
    .replace('href=\"/login\">预约演示', `href=\"${escapeHtml(config.navigation.cta.href)}\">${escapeHtml(config.navigation.cta.label)}`)
    .replace('href=\"/login\">预约增长诊断 →', `href=\"${escapeHtml(config.hero.primaryAction.href)}\">${escapeHtml(config.hero.primaryAction.label)}`)
    .replace('href=\"#journey\">查看客户旅程', `href=\"${escapeHtml(config.hero.secondaryAction.href)}\">${escapeHtml(config.hero.secondaryAction.label)}`);

  markup = replaceFirst(
    markup,
    /<div class=\"links\">[\s\S]*?<\/div>\n          <div class=\"nav-actions\">/,
    `<div class=\"links\">\n            ${navLinksMarkup(config)}\n          </div>\n          <div class=\"nav-actions\">`,
  );
  markup = replaceFirst(
    markup,
    /<p class=\"lead\">[\s\S]*?<\/p>/,
    `<p class=\"lead\">${escapeHtml(config.hero.description)}</p>`,
  );
  markup = replaceFirst(
    markup,
    /<div class=\"editor-note\">[\s\S]*?<\/div>/,
    `<div class=\"editor-note\">${escapeHtml(config.hero.note)}</div>`,
  );
  markup = replaceFirst(
    markup,
    /<div class=\"metrics\">[\s\S]*?<\/div>\n\n        <aside class=\"growth-card\">/,
    `<div class=\"metrics\">\n          ${metricsMarkup(config)}\n        </div>\n\n        <aside class=\"growth-card\">`,
  );
  markup = replaceFirst(
    markup,
    /<div class=\"card-top\">[\s\S]*?<\/div>\n          <div class=\"funnel\">/,
    `<div class=\"card-top\">\n            <div><b>${escapeHtml(config.growthCard.title)}</b><span>${escapeHtml(config.growthCard.subtitle)}</span></div>\n            <div class=\"badge\">${escapeHtml(config.growthCard.badge)}</div>\n          </div>\n          <div class=\"funnel\">`,
  );
  markup = replaceFirst(
    markup,
    /<div class=\"funnel\">[\s\S]*?<\/div>\n          <div class=\"advisor-inline\">/,
    `<div class=\"funnel\">\n            ${growthRowsMarkup(config)}\n          </div>\n          <div class=\"advisor-inline\">`,
  );

  markup = markup
    .replace('<small>下一步建议</small>', `<small>${escapeHtml(config.growthCard.insight.eyebrow)}</small>`)
    .replace('<h3>优先承接 18 位复购窗口客户</h3>', `<h3>${escapeHtml(config.growthCard.insight.title)}</h3>`)
    .replace('92%匹配', escapeHtml(config.growthCard.insight.confidence))
    .replace('她们处于术后第 21-30 天，近期咨询补水与修复项目，建议由资深咨询师人工跟进。', escapeHtml(config.growthCard.insight.description))
    .replace('<div class=\"chips\"><span>高意向</span><span>复购窗口</span><span>需人工承接</span></div>', `<div class=\"chips\">${config.growthCard.insight.chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}</div>`);

  markup = replaceFirst(
    markup,
    /<section id=\"diagnosis\" class=\"band diagnosis\">[\s\S]*?<\/section>/,
    diagnosisSectionMarkup(config),
  );
  markup = replaceFirst(
    markup,
    /<section id=\"journey\" class=\"band journey\">[\s\S]*?<\/section>/,
    journeySectionMarkup(config),
  );
  markup = replaceFirst(
    markup,
    /<section id=\"agents\" class=\"band agents\">[\s\S]*?<\/section>/,
    agentSectionMarkup(config),
  );
  markup = replaceFirst(
    markup,
    /<section id=\"cases\" class=\"band case-band\">[\s\S]*?<\/section>/,
    caseSectionMarkup(config),
  );
  markup = replaceFirst(
    markup,
    /<section id=\"pricing\" class=\"band pricing\">[\s\S]*?<\/section>/,
    pricingSectionMarkup(config),
  );
  markup = replaceFirst(
    markup,
    /<section class=\"final-cta\">[\s\S]*?<\/section>/,
    finalCtaSectionMarkup(config),
  );

  return markup.replace(/\n    <\/div>$/, `\n      ${homepageFooterMarkup(config)}\n    </div>`);
}

export function buildMarketingHomePreviewDocument(config: HomepageBrandConfig = defaultHomepageBrandConfig) {
  const previewMarkup = withPreviewEditTargets(buildMarketingHomeMarkup(config));

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>真实首页草稿预览</title>
    <style>
      html, body { margin: 0; min-height: 100%; background: #ffffff; }
      ${luxuryCss}
      ${homepageFooterCss}
      .homepage-preview-editable { cursor: pointer; }
      .homepage-preview-editable:hover { outline: 3px solid rgba(37, 99, 235, 0.75); outline-offset: -3px; }
      .homepage-preview-selected { outline: 3px solid rgba(37, 99, 235, 0.95); outline-offset: -3px; }
    </style>
  </head>
  <body>
    <div class="luxuryRoot">
      ${previewMarkup}
    </div>
    <script>${homepagePreviewBridgeScript}<\/script>
  </body>
</html>`;
}

export function MarketingHome({ config = defaultHomepageBrandConfig }: { config?: HomepageBrandConfig }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const themeStorageKey = 'zmtg-home-theme';
    const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const toggle = root.querySelector<HTMLButtonElement>('.theme-toggle');
    const toggleLabel = root.querySelector<HTMLElement>('.theme-toggle-label');
    const getStoredTheme = () => {
      try {
        return window.localStorage.getItem(themeStorageKey);
      } catch {
        return null;
      }
    };
    const applyTheme = (theme: 'light' | 'dark') => {
      root.classList.toggle('theme-dark', theme === 'dark');
      root.dataset.theme = theme;
      if (toggle) {
        const nextLabel = theme === 'dark' ? '切换日间模式' : '切换夜间模式';
        toggle.setAttribute('aria-label', nextLabel);
        toggle.setAttribute('title', nextLabel);
      }
      if (toggleLabel) toggleLabel.textContent = theme === 'dark' ? '日间模式' : '夜间模式';
    };
    const resolveTheme = (): 'light' | 'dark' => (getStoredTheme() === 'dark' || (!getStoredTheme() && themeQuery.matches) ? 'dark' : 'light');
    applyTheme(resolveTheme());

    const handleThemeClick = () => {
      const nextTheme = root.classList.contains('theme-dark') ? 'light' : 'dark';
      applyTheme(nextTheme);
      try {
        window.localStorage.setItem(themeStorageKey, nextTheme);
      } catch {}
    };
    const handleSystemTheme = () => {
      if (!getStoredTheme()) applyTheme(themeQuery.matches ? 'dark' : 'light');
    };
    toggle?.addEventListener('click', handleThemeClick);
    themeQuery.addEventListener?.('change', handleSystemTheme);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.add('motion-ready');

    const revealTargets = [
      '.section-head',
      '.diag',
      '.journey-panel',
      '.journey-screen',
      '.timeline-item',
      '.lane',
      '.agent-card',
      '.case-quote',
      '.case-stat',
      '.price-card',
      '.cta-box',
      '.growth-card',
      '.metrics',
    ];

    root.querySelectorAll(revealTargets.join(',')).forEach((el) => {
      el.classList.add('reveal');
    });

    const countTargets = root.querySelectorAll('.metric strong, .row-head strong, .case-stat strong');

    const parseCount = (text: string) => {
      const trimmed = text.trim();
      if (trimmed.includes('×')) return null;
      const match = trimmed.match(/^([^0-9]*)([0-9][0-9,.]*)(.*)$/);
      if (!match) return null;
      const rawNumber = match[2].replace(/,/g, '');
      const value = Number(rawNumber);
      if (!Number.isFinite(value)) return null;
      return {
        prefix: match[1],
        value,
        suffix: match[3],
        decimals: rawNumber.includes('.') ? rawNumber.split('.')[1].length : 0,
        comma: match[2].includes(','),
      };
    };

    const formatCount = (parts: NonNullable<ReturnType<typeof parseCount>>, value: number) => {
      const fixed = value.toFixed(parts.decimals);
      const number = parts.comma ? fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : fixed;
      return `${parts.prefix}${number}${parts.suffix}`;
    };

    const animateCount = (el: Element | null) => {
      if (!(el instanceof HTMLElement) || el.dataset.counted === 'true') return;
      const parts = parseCount(el.textContent || '');
      if (!parts) return;
      el.dataset.counted = 'true';
      el.classList.add('counting');

      if (reduceMotion) return;

      const duration = 1100;
      const startTime = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = formatCount(parts, parts.value * eased);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = formatCount(parts, parts.value);
        }
      };
      requestAnimationFrame(step);
    };

    if (reduceMotion || !('IntersectionObserver' in window)) {
      root.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      countTargets.forEach(animateCount);
      requestAnimationFrame(() => root.classList.add('is-ready'));
      return () => {
        toggle?.removeEventListener('click', handleThemeClick);
        themeQuery.removeEventListener?.('change', handleSystemTheme);
      };
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        entry.target.querySelectorAll?.('.metric strong, .row-head strong, .case-stat strong').forEach(animateCount);
        if (entry.target.matches('.metric, .row, .case-stat')) animateCount(entry.target.querySelector('strong'));
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

    root.querySelectorAll('.reveal, .metric, .row, .case-stat').forEach((el) => observer.observe(el));

    const readyFrame = requestAnimationFrame(() => {
      root.classList.add('is-ready');
      root.querySelector('.growth-card')?.classList.add('is-visible');
      root.querySelector('.metrics')?.classList.add('is-visible');
    });

    return () => {
      cancelAnimationFrame(readyFrame);
      observer.disconnect();
      toggle?.removeEventListener('click', handleThemeClick);
      themeQuery.removeEventListener?.('change', handleSystemTheme);
    };
  }, []);

  return (
    <div ref={rootRef} className="luxuryRoot">
      <style>{luxuryCss}</style>
      <style>{homepageFooterCss}</style>
      <div dangerouslySetInnerHTML={{ __html: buildMarketingHomeMarkup(config) }} />
    </div>
  );
}
