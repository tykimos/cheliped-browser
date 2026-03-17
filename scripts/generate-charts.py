#!/usr/bin/env python3
"""Generate benchmark bar charts for README."""

import matplotlib.pyplot as plt
import matplotlib
import numpy as np
import os

matplotlib.use('Agg')

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'docs', 'images')
os.makedirs(OUT_DIR, exist_ok=True)

# --- Colors: Cheliped = red accent, others = grayscale ---
COLORS = {
    'Cheliped': '#e74c3c',
    'Playwright': '#999999',
    'Puppeteer': '#bbbbbb',
    'agent-browser': '#666666',
}

# --- "lower is better" uses down arrow + green accent for Cheliped being lowest
#     "higher is better" uses up arrow + green accent for Cheliped being highest
LOWER_NOTE_COLOR = '#2980b9'
HIGHER_NOTE_COLOR = '#27ae60'


def style_ax(ax, title, ylabel, direction=None):
    """direction: 'lower' or 'higher'"""
    ax.set_title(title, fontsize=14, fontweight='bold', pad=12)
    ax.set_ylabel(ylabel, fontsize=11)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.tick_params(axis='x', labelsize=10)
    ax.tick_params(axis='y', labelsize=10)
    ax.yaxis.grid(True, alpha=0.3, linestyle='--')
    ax.set_axisbelow(True)
    if direction == 'lower':
        ax.annotate('\u2193 lower is better', xy=(0.5, -0.13), xycoords='axes fraction',
                    ha='center', fontsize=10, color=LOWER_NOTE_COLOR, fontweight='bold')
    elif direction == 'higher':
        ax.annotate('\u2191 higher is better', xy=(0.5, -0.13), xycoords='axes fraction',
                    ha='center', fontsize=10, color=HIGHER_NOTE_COLOR, fontweight='bold')


def add_value_labels(ax, bars, fmt='{:.0f}', highlight_idx=0):
    for i, bar in enumerate(bars):
        h = bar.get_height()
        color = '#c0392b' if i == highlight_idx else '#555'
        ax.text(bar.get_x() + bar.get_width() / 2, h,
                fmt.format(h), ha='center', va='bottom',
                fontsize=9, fontweight='bold', color=color)


# ============================================================
# 1. Summary: Avg Tokens / Avg Speed / Quality (3-in-1)
# ============================================================
fig, axes = plt.subplots(1, 3, figsize=(16, 5.5))

tools = ['Cheliped', 'Playwright', 'Puppeteer', 'agent-browser']
colors = [COLORS[t] for t in tools]

# 1a. Avg Tokens (lower is better)
vals = [2864, 5704, 5051, 11882]
bars = axes[0].bar(tools, vals, color=colors, width=0.6, edgecolor='white', linewidth=0.5)
style_ax(axes[0], 'Average Output Tokens', 'Tokens', direction='lower')
axes[0].set_ylim(0, max(vals) * 1.18)
add_value_labels(axes[0], bars)

# 1b. Avg Speed (lower is better)
vals = [51, 78, 81, 205]
bars = axes[1].bar(tools, vals, color=colors, width=0.6, edgecolor='white', linewidth=0.5)
style_ax(axes[1], 'Average Extraction Speed', 'ms', direction='lower')
axes[1].set_ylim(0, max(vals) * 1.18)
add_value_labels(axes[1], bars)

# 1c. Quality Score (higher is better)
vals = [86.4, 75.4, 73.4, 72.8]
bars = axes[2].bar(tools, vals, color=colors, width=0.6, edgecolor='white', linewidth=0.5)
style_ax(axes[2], 'Content Recognition Quality', 'Score %', direction='higher')
axes[2].set_ylim(0, 105)
add_value_labels(axes[2], bars, fmt='{:.1f}%')

for ax in axes:
    ax.set_xticks(range(len(tools)))
    ax.set_xticklabels(tools, rotation=15, ha='right')

plt.tight_layout(pad=2)
plt.savefig(os.path.join(OUT_DIR, 'benchmark-summary.png'), dpi=150, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.close()


# ============================================================
# 2. Quality Breakdown by Metric (grouped bar) — higher is better
# ============================================================
fig, ax = plt.subplots(figsize=(14, 6.5))

metrics = ['Text\nRecall', 'Link\nRecall', 'Link\nPrecision', 'Button\nRecall', 'Input\nRecall', 'Heading\nRecall']
data = {
    'Cheliped':       [80.8, 97.3, 85.6, 97.9, 67.9, 89.1],
    'Playwright':     [76.8, 85.0, 88.2, 82.4, 33.3, 86.4],
    'Puppeteer':      [76.2, 84.2, 87.8, 55.1, 50.0, 86.7],
    'agent-browser':  [77.7, 85.4, 90.5, 92.3,  1.2, 88.1],
}

x = np.arange(len(metrics))
n = len(data)
width = 0.18
offsets = np.linspace(-(n-1)/2 * width, (n-1)/2 * width, n)

for i, (name, vals) in enumerate(data.items()):
    bars = ax.bar(x + offsets[i], vals, width, label=name, color=COLORS[name],
                  edgecolor='white', linewidth=0.5)
    label_color = '#c0392b' if name == 'Cheliped' else '#777'
    for bar, v in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.8,
                f'{v:.0f}', ha='center', va='bottom', fontsize=7.5,
                fontweight='bold', color=label_color)

ax.set_xticks(x)
ax.set_xticklabels(metrics, fontsize=11)
style_ax(ax, 'Quality Breakdown by Metric', 'Score %', direction='higher')
ax.set_ylim(0, 112)
ax.legend(loc='upper right', fontsize=10, framealpha=0.9)

plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'benchmark-quality-breakdown.png'), dpi=150, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.close()


# ============================================================
# 3. Per-Site Token Comparison (grouped bar) — lower is better
# ============================================================
fig, ax = plt.subplots(figsize=(14, 6.5))

sites = ['Hacker\nNews', 'Wikipedia', 'GitHub', 'Example\n.com', 'React\n(SPA)', 'MDN\nWeb Docs']
data = {
    'Cheliped':       [2497, 7281, 3863, 111, 521, 2912],
    'Playwright':     [10014, 15417, 2347, 58, 488, 5901],
    'Puppeteer':      [4795, 19744, 1592, 71, 388, 3717],
    'agent-browser':  [15300, 39475, 4180, 120, 1016, 11203],
}

x = np.arange(len(sites))

for i, (name, vals) in enumerate(data.items()):
    ax.bar(x + offsets[i], vals, width, label=name, color=COLORS[name],
           edgecolor='white', linewidth=0.5)

ax.set_xticks(x)
ax.set_xticklabels(sites, fontsize=11)
style_ax(ax, 'Output Tokens per Site', 'Tokens', direction='lower')
ax.set_ylim(0, 42000)
ax.legend(loc='upper right', fontsize=10, framealpha=0.9)

plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'benchmark-tokens-per-site.png'), dpi=150, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.close()


# ============================================================
# 4. Per-Site Speed Comparison (grouped bar) — lower is better
# ============================================================
fig, ax = plt.subplots(figsize=(14, 6.5))

data = {
    'Cheliped':       [46, 83, 113, 7, 6, 52],
    'Playwright':     [82, 86, 124, 23, 28, 127],
    'Puppeteer':      [72, 167, 112, 33, 24, 77],
    'agent-browser':  [209, 270, 188, 174, 175, 214],
}

for i, (name, vals) in enumerate(data.items()):
    ax.bar(x + offsets[i], vals, width, label=name, color=COLORS[name],
           edgecolor='white', linewidth=0.5)

ax.set_xticks(x)
ax.set_xticklabels(sites, fontsize=11)
style_ax(ax, 'Extraction Speed per Site', 'ms', direction='lower')
ax.set_ylim(0, 300)
ax.legend(loc='upper right', fontsize=10, framealpha=0.9)

plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'benchmark-speed-per-site.png'), dpi=150, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.close()


print('Charts generated:')
for f in sorted(os.listdir(OUT_DIR)):
    fpath = os.path.join(OUT_DIR, f)
    size_kb = os.path.getsize(fpath) / 1024
    print(f'  {f} ({size_kb:.0f} KB)')
