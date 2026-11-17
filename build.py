import glob
js='\n'.join(open(f).read() for f in sorted(glob.glob('src/[0-9]*.js')))
html=open('src/shell.html').read().replace('/*__JS__*/',js)
open('dist/index.html','w').write(html)
print(len(html))
