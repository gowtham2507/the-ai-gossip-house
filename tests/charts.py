"""Build behaviour charts from a behaviour study JSON: python3 tests/charts.py /tmp/b11.json"""
import json, sys, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt, numpy as np
d=json.load(open(sys.argv[1])); OUT='docs/images/'
ids=['alex','mia','ryan','luna','max','sophia','noah','zara','ethan','ivy']; N=[i.capitalize() for i in ids]
COL={'alex':'#2f6fdc','mia':'#ff7eb6','ryan':'#d64045','luna':'#8fd3c9','max':'#ffb703','sophia':'#6b7280','noah':'#6b8f71','zara':'#b5179e','ethan':'#f4a261','ivy':'#20c997'}
plt.rcParams.update({'figure.facecolor':'#141026','axes.facecolor':'#1d1838','axes.edgecolor':'#36305e','text.color':'#f3f0ff','axes.labelcolor':'#f3f0ff','xtick.color':'#c9c3ea','ytick.color':'#c9c3ea','font.size':10,'axes.titleweight':'bold','axes.titlesize':13})
# 1 relationship heatmaps
fig,axs=plt.subplots(1,3,figsize=(17,5.6))
for ax,field,cmap in zip(axs,['trust','friendship','resentment'],['viridis','YlOrBr','Reds']):
    M=np.array([[d['rel'][a][b][field] if a!=b else np.nan for b in ids] for a in ids])
    im=ax.imshow(M,cmap=cmap,vmin=0,vmax=100)
    ax.set_xticks(range(10)); ax.set_xticklabels(N,rotation=60); ax.set_yticks(range(10)); ax.set_yticklabels(N)
    ax.set_title(f'{field.capitalize()} (row → column), end of day 5'); ax.set_xlabel('how they are seen'); ax.set_ylabel('who feels it')
    for i in range(10):
        for j in range(10):
            if i!=j: ax.text(j,i,int(M[i,j]),ha='center',va='center',fontsize=7,color='white' if (M[i,j]<55 or field=='resentment' and M[i,j]>45) else 'black')
    fig.colorbar(im,ax=ax,fraction=0.046)
fig.tight_layout(); fig.savefig(OUT+'chart_relationships.png',dpi=130); plt.close(fig)
# 2 behaviour profile
CATS={'Friendly':['chat','greet','compliment','thank','react','laugh','support','accept','invite','dunno'],'Humor':['joke','joke_about'],'Gossip & secrets':['gossip','reveal','ask_about','confide','complain'],'Discretion':['keep_secret','caution'],'Conflict':['confront','insult','offended','refuse','deflect','defend','strong_opinion','cry_out','deny'],'Repair':['apologize','forgive','comfort','mediate','calm'],'Romance':['flirt','awkward','confess','accept_love','reject_love'],'Strategy':['ally','accept_ally'],'Games':['game_ask','game_answer','game_dodge']}
CC=['#7cc4ff','#ffd166','#ff7eb6','#4fd1c5','#ff6b6b','#5ee6a8','#ff9ff3','#b39cff','#ff9f43']
fig,ax=plt.subplots(figsize=(13,5.6)); left=np.zeros(10)
for (cat,ins),c in zip(CATS.items(),CC):
    v=np.array([sum(d['stats'][a]['intents'].get(i,0) for i in ins)/max(1,sum(d['stats'][a]['intents'].values()))*100 for a in ids])
    ax.barh(N,v,left=left,color=c,label=cat); left+=v
ax.invert_yaxis(); ax.set_xlim(0,100); ax.set_xlabel('% of their spoken lines'); ax.set_title('What each housemate spends their words on (5 simulated days, seed 11)')
ax.legend(ncol=5,loc='upper center',bbox_to_anchor=(0.5,-0.13),frameon=False)
for i,a in enumerate(ids): ax.text(101,i,f"{d['stats'][a]['lines']} lines",va='center',fontsize=9,color='#c9c3ea')
fig.tight_layout(); fig.savefig(OUT+'chart_behaviour_profile.png',dpi=130); plt.close(fig)
# 3 time use
ACTG={'Sleeping':['sleep'],'Talking':['talk','approach'],'Partying':['dance','partyhang','dj','plan_party','snack'],'Hobby':['hobby','cook'],'Eating':['eat'],'TV & relaxing':['tv','stroll'],'Alone / upset':['solitude','cry','pace','avoid'],'Moving & other':['walk','idle','bathroom','cleanup']}
AC=['#3a3f6b','#ff7eb6','#b5179e','#5ee6a8','#ffd166','#7cc4ff','#ff6b6b','#8a84ad']
fig,ax=plt.subplots(figsize=(13,5.2)); left=np.zeros(10)
for (g,acts),c in zip(ACTG.items(),AC):
    v=np.array([sum(d['stats'][a]['acts'].get(x,0) for x in acts)/max(1,sum(d['stats'][a]['acts'].values()))*100 for a in ids])
    ax.barh(N,v,left=left,color=c,label=g); left+=v
ax.invert_yaxis(); ax.set_xlim(0,100); ax.set_xlabel('% of simulated time'); ax.set_title('How each housemate spends their time (needs + personality, no schedule)')
ax.legend(ncol=8,loc='upper center',bbox_to_anchor=(0.5,-0.13),frameon=False,fontsize=9)
fig.tight_layout(); fig.savefig(OUT+'chart_time_use.png',dpi=130); plt.close(fig)
# 4 drama timeline
TYPES=[('party','#b5179e','Party'),('conflict','#ff6b6b','Conflict'),('reconcile','#5ee6a8','Reconcile'),('jealousy','#4fd1c5','Jealousy'),('secret','#7cc4ff','Confided'),('leak','#ffd166','Secret spread'),('betrayal','#ff4500','Betrayal'),('confession','#ff7eb6','Truth-or-Dare confession'),('cry','#9ecbff','Crying'),('comfort','#c7f9cc','Comfort'),('alliance','#b39cff','Alliance'),('romance','#ff69b4','Romance')]
fig,ax=plt.subplots(figsize=(15,5))
for k,(t,c,l) in enumerate(TYPES):
    xs=[(e['t']-480)/1440 for e in d['events'] if e['type']==t]
    ax.scatter(xs,[k]*len(xs),s=60,color=c,label=l,edgecolor='white',linewidth=0.4)
ax.set_yticks(range(len(TYPES))); ax.set_yticklabels([l for _,_,l in TYPES]); ax.set_xlabel('simulated days since 08:00 on day 1')
for day in range(1,6): ax.axvspan(day-1+(19-8)/24, day-1+(31-8)/24, color='#000',alpha=0.18)
ax.set_title('Timeline of social events (shaded = evening/night)'); ax.set_xlim(0,5); ax.grid(axis='x',color='#36305e')
fig.tight_layout(); fig.savefig(OUT+'chart_timeline.png',dpi=130); plt.close(fig)
# 5 secret spread
secs=[s for s in d['secrets']]
fig,ax=plt.subplots(figsize=(13,5.4))
for i,s in enumerate(secs):
    for j,a in enumerate(ids):
        if a in s['knownBy']:
            c='#ffd166' if a==s['owner'] else ('#5ee6a8' if a in s['confidedTo'] else '#ff6b6b')
            ax.scatter(j,i,s=150,color=c,edgecolor='white',linewidth=0.5)
ax.set_xticks(range(10)); ax.set_xticklabels(N); ax.set_yticks(range(len(secs))); ax.set_yticklabels([s['content'][:58]+('…' if len(s['content'])>58 else '')+(' (public)' if s['public'] else '') for s in secs],fontsize=8.5)
ax.invert_yaxis(); ax.set_title('Who knows each secret after 5 days\n● gold = owner   ● green = told in confidence   ● red = overheard or heard secondhand',fontsize=12)
fig.tight_layout(); fig.savefig(OUT+'chart_secret_spread.png',dpi=130); plt.close(fig)
print('ok')
