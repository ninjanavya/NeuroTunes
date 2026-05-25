import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

cache_buster = """
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response
"""

if '@app.after_request' not in content:
    content = content.replace('app = Flask(__name__)\n', 'app = Flask(__name__)\n' + cache_buster + '\n')
    
    with open('app.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Cache buster added")
else:
    print("Cache buster already present")
