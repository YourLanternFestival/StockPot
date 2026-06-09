#!/usr/bin/env python3
"""Generate the organic biophilic food community prototype."""
import json, os

# Load embedded images
with open('assets/img/embed.json', 'r') as f:
    IMG = json.load(f)

# Read the HTML template
with open('scripts/biophilic_template.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace placeholders
replacements = {
    '___FOOD1___': IMG['food1'],
    '___FOOD2___': IMG['food2'],
    '___FOOD3___': IMG['food3'],
    '___FOOD_BREAD___': IMG['food_bread'],
    '___LINEN___': IMG['linen'],
}

for placeholder, b64 in replacements.items():
    html = html.replace(placeholder, b64)

os.makedirs('design-demos', exist_ok=True)
with open('design-demos/organic-biophilic.html', 'w', encoding='utf-8') as f:
    f.write(html)
print(f'Written: {len(html)} chars')
