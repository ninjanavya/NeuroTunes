import os

with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

html_start = -1
html_end = -1
for i, line in enumerate(lines):
    if line.startswith('HTML_PAGE = r"""'):
        html_start = i
    elif line.startswith('"""') and html_start != -1 and i > html_start:
        html_end = i
        break

if html_start != -1 and html_end != -1:
    html_content = "".join(lines[html_start+1:html_end])
    os.makedirs('templates', exist_ok=True)
    with open('templates/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    new_lines = lines[:html_start] + lines[html_end+1:]
    
    for i in range(len(new_lines)):
        if 'render_template_string(HTML_PAGE)' in new_lines[i]:
            new_lines[i] = new_lines[i].replace('render_template_string(HTML_PAGE)', 'render_template("index.html")')
            
    for i in range(len(new_lines)):
        if 'from flask import' in new_lines[i]:
            if 'render_template,' not in new_lines[i] and ' render_template ' not in new_lines[i]:
                new_lines[i] = new_lines[i].replace('from flask import ', 'from flask import render_template, ')
            break

    with open('app.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print('Refactoring successful!')
else:
    print('Could not find HTML_PAGE block')
