#!/usr/bin/env python3
"""Build the version-2 HadCM3 walkthrough pages.

Version 2 = the version-1 pages (one level up, left untouched) with each component's
linear chart replaced by a network drawn from src/hadcm3_net.js, styled by src/net.css.
Both source files are inlined, so each output page is a single self-contained file
(apart from Google Fonts and dagre from cdnjs).

    python3 build_v2.py          # writes HadCM3_walkthrough_v2_en.html and _zh.html
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
V1_DIR = HERE.parent

# Published artifact URLs, used by the language switch and cross-links on the published pages.
V1_URL = {'en': 'https://claude.ai/artifact/NvLiK1jmDgtQTWMkfUsAWK', 'zh': 'https://claude.ai/artifact/JbUE1UPjD2kXQjNeMWsRhw'}
V2_URL = {'en': 'https://claude.ai/artifact/Lg1UbvqWPZuGRLGoEN2T49', 'zh': 'https://claude.ai/artifact/MGA4sQtd2KCcZ9YcxvpK9a'}
DAGRE = 'https://cdnjs.cloudflare.com/ajax/libs/dagre/0.8.5/dagre.min.js'

TEXT = {
    'en': {
        'title': 'HadCM3 Time-Step Walkthrough v2',
        'desc': 'Version 2 of the interactive HadCM3 walkthrough (UM vn4.5, pre-industrial job tdaah): each component drawn as a network of routines, variables and parameters.',
        'ver': '<p class="ver"><span class="vtag">v2</span>Each component below is drawn as a network of routines, the variables they pass between them, and every parameter they use. '
               '<a class="xlink" href="../HadCM3_timestep_walkthrough_en.html" data-artifact="{v1}">Version 1</a> keeps the simpler linear charts.</p>',
        'intro_old_start': '<p>Each tab charts one component in call order:',
        'intro': '<p>Each tab draws one component as a network. Numbered boxes are its routines in call order, joined by the thick line; plain boxes are the variables they hand to each other; '
                 'coloured rounded boxes enter from or leave to another component, in that component’s colour; dashed boxes list the parameters each routine uses, with their tdaah values. '
                 'Point at any box to light up its connections, click it to pin it and read what it reads and writes, and drag the background to pan. Dashed routines run only on some steps; grey ones are switched off in this job.</p>',
        'flow_block': '  /* ---------------- component flowcharts ---------------- */',
        'tabs_block': '  /* ---------------- tabs ---------------- */',
        'lang_old': 'href="HadCM3_timestep_walkthrough_zh.html" data-artifact="https://claude.ai/artifact/JbUE1UPjD2kXQjNeMWsRhw"',
        'lang_new': 'href="HadCM3_walkthrough_v2_zh.html" data-artifact="{v2zh}"',
        'companion': '  <span>Companion page:',
        'footer': '  <span>Version 2 networks: <span class="mono">v2/src/hadcm3_net.js</span>, built into this page by <span class="mono">v2/build_v2.py</span> from the version 1 page.</span>\n',
    },
    'zh': {
        'title': 'HadCM3 时间步拆解 第二版',
        'desc': 'HadCM3 交互式拆解第二版（UM vn4.5，工业革命前作业 tdaah）：每个分量画成由子程序、变量和参数组成的网络。',
        'ver': '<p class="ver"><span class="vtag">v2</span>下面每个分量都画成网络：子程序、它们之间传递的变量，以及用到的每个参数。'
               '<a class="xlink" href="../HadCM3_timestep_walkthrough_zh.html" data-artifact="{v1}">第一版</a>保留了较简单的线性流程图。</p>',
        'intro_old_start': '<p>每个标签按调用顺序画出一个分量：',
        'intro': '<p>每个标签把一个分量画成网络。带编号的方框是按调用顺序排列的子程序，用粗线相连；白色方框是它们之间传递的变量；'
                 '彩色圆角框是来自或去往其他分量的量，颜色与那个分量一致；虚线框列出每个子程序用到的参数及其 tdaah 取值。'
                 '鼠标移到任一方框上会点亮它的连接，点击可固定并查看它读入和写出什么，拖动背景可以平移。虚线子程序只在部分步运行；灰色的在本作业中关闭。</p>',
        'flow_block': '  /* ---------------- 分量流程图 ---------------- */',
        'tabs_block': '  /* ---------------- 标签页 ---------------- */',
        'lang_old': 'href="HadCM3_timestep_walkthrough_en.html" data-artifact="https://claude.ai/artifact/NvLiK1jmDgtQTWMkfUsAWK"',
        'lang_new': 'href="HadCM3_walkthrough_v2_en.html" data-artifact="{v2en}"',
        'companion': '  <span>姊妹页：',
        'footer': '  <span>第二版网络数据：<span class="mono">v2/src/hadcm3_net.js</span>，由 <span class="mono">v2/build_v2.py</span> 从第一版页面生成。</span>\n',
    },
}


def once(s, old, new, what):
    n = s.count(old)
    if n != 1:
        sys.exit(f'build_v2: {what}: expected 1 match, found {n}')
    return s.replace(old, new)


def cut(s, start, end, new, what):
    """Replace s[start:end) (start marker included, end marker kept)."""
    i, j = s.find(start), s.find(end)
    if i < 0 or j < 0 or j < i or s.count(start) != 1:
        sys.exit(f'build_v2: {what}: markers not found once and in order')
    return s[:i] + new + s[j:]


def build(lang):
    t = TEXT[lang]
    src = (V1_DIR / f'HadCM3_timestep_walkthrough_{lang}.html').read_text(encoding='utf-8')
    net_js = (HERE / 'src' / 'hadcm3_net.js').read_text(encoding='utf-8')
    net_css = (HERE / 'src' / 'net.css').read_text(encoding='utf-8')
    if '</script' in net_js:
        sys.exit('build_v2: hadcm3_net.js must not contain "</script"')
    s = src

    # head
    s = re.sub(r'<title>[^<]*</title>', f'<title>{t["title"]}</title>', s, count=1)
    s = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{t["desc"]}">', s, count=1)

    # stylesheet: swap the version-1 linear-chart rules for the network rules
    s = cut(s, '/* ---------- component flowcharts ---------- */', 'footer { color:', net_css, 'chart CSS')

    # header: language switch to the other v2 page, version note under the title
    s = once(s, t['lang_old'], t['lang_new'].format(v2en=V2_URL['en'], v2zh=V2_URL['zh']), 'language link')
    s = re.sub(r'(<h1>[^<]*</h1>)', lambda m: m.group(1) + '\n  ' + t['ver'].format(v1=V1_URL[lang]), s, count=1)

    # components intro
    i = s.find(t['intro_old_start'])
    if i < 0:
        sys.exit('build_v2: components intro not found')
    j = s.find('</p>', i) + len('</p>')
    s = s[:i] + t['intro'] + s[j:]

    # footer: paths are one level deeper; note where the networks come from
    s = once(s, 'href="../cGENIE-visualization/', 'href="../../cGENIE-visualization/', 'cGENIE companion link')
    s = once(s, t['companion'], t['footer'] + t['companion'], 'footer note')

    # scripts: dagre + the network code before the page script, which learns its language
    s = once(s, '\n<script>\n(function () {\n',
             f'\n<script src="{DAGRE}"></script>\n<script>\n{net_js}</script>\n<script>\n(function () {{\n  const LANG = \'{lang}\';\n',
             'page script start')

    # page script: drop the linear-chart renderer, render networks instead
    s = cut(s, t['flow_block'], t['tabs_block'], '  HadNet.init(MODS, LANG, k => openTab(k, { scroll: true }));\n\n', 'linear-chart renderer')
    s = once(s, 'body += flowHTML(m) + paramTable(m);', 'body += HadNet.panel(m);', 'panel body')
    s = once(s, "$$('.mod').forEach(p => { p.hidden = p.id !== 'pan-' + key; });",
             "$$('.mod').forEach(p => { p.hidden = p.id !== 'pan-' + key; });\n    HadNet.show(key);", 'openTab hook')
    s = once(s, '  render(); setPlayUI();\n})();',
             "  HadNet.show((document.querySelector('.mod:not([hidden])') || { id: 'pan-' }).id.slice(4));\n  render(); setPlayUI();\n})();",
             'first network')

    for leftover in ('flowHTML', 'paramTable(', 'mflow'):
        if leftover in s:
            sys.exit(f'build_v2: leftover "{leftover}" in the {lang} page')
    out = HERE / f'HadCM3_walkthrough_v2_{lang}.html'
    out.write_text(s, encoding='utf-8')
    print(f'wrote {out.name} ({len(s):,} bytes)')


if __name__ == '__main__':
    for lang in ('en', 'zh'):
        build(lang)
