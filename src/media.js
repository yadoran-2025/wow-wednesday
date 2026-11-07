function mediaLink(value) {
  const url = new URL(value);
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('http:// 또는 https://로 시작하는 음원 링크를 입력해 주세요.');
  return url;
}

function youtubeId(value) {
  let url;
  try {url=mediaLink(value);} catch {return '';}
  const host=url.hostname.toLowerCase();
  let id='';
  if (host==='youtu.be') id=url.pathname.slice(1).split('/')[0];
  if (['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)) {
    id=url.searchParams.get('v') || (/^\/(embed|shorts|live)\//.test(url.pathname)?url.pathname.split('/')[2]:'');
  }
  return /^[\w-]{11}$/.test(id || '')?id:'';
}

let youtubeReady;
function loadYoutubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeReady) return youtubeReady;
  youtubeReady=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{youtubeReady=null;reject(new Error('YouTube 연결 시간이 초과됐습니다. 네트워크를 확인하고 다시 재생해 주세요.'));},12000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);resolve(window.YT);};
    let script=document.querySelector('script[data-youtube-api]');
    if (script) script.remove();
    script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.dataset.youtubeApi='true';
    script.onerror=()=>{clearTimeout(timeout);youtubeReady=null;reject(new Error('YouTube에 연결할 수 없습니다. 원본 링크에서 확인해 주세요.'));};
    document.head.appendChild(script);
  });
  return youtubeReady;
}

class LessonMedia {
  constructor({onState,onDuration,onError}) {
    this.local=document.querySelector('#local-media');
    this.dock=document.querySelector('#media-dock');
    this.youtubeHost=document.querySelector('#youtube-media');
    this.onState=onState;this.onDuration=onDuration;this.onError=onError;
    this.generation=0;this.playRequest=0;this.ready=Promise.resolve();
    this.local.addEventListener('play',()=>{
      if(this.spec && (this.local.currentTime<this.spec.start || this.local.currentTime>=this.spec.end))this.local.currentTime=this.spec.start;
      this.onState(true);
    });
    this.local.addEventListener('pause',()=>this.onState(false));
    this.local.addEventListener('ended',()=>this.onState(false));
    this.layoutObserver=new ResizeObserver(()=>this.place());
    this.layoutObserver.observe(document.body);
    window.addEventListener('resize',()=>this.place());
  }

  // Keep the iframe connected: moving it between renders reloads YouTube playback.
  park() {this.slot=null;this.dock.hidden=true;}
  mount(slot) {
    if(!slot || !this.spec)return;
    this.slot=slot;this.dock.hidden=false;
    slot.classList.toggle('youtube-slot',Boolean(this.spec.videoId));
    this.place();
  }
  place() {
    if(!this.slot?.isConnected || this.dock.hidden)return;
    const rect=this.slot.getBoundingClientRect();
    const height=this.spec?.videoId?220:this.spec?.audioOnly?58:rect.width*9/16;
    this.slot.style.height=`${height}px`;
    Object.assign(this.dock.style,{position:'absolute',margin:'0',top:`${rect.top+scrollY}px`,left:`${rect.left+scrollX}px`,width:`${rect.width}px`,height:`${height}px`});
  }
  pause() {this.playRequest++;this.local.pause();this.player?.pauseVideo?.();this.onState(false);}
  get time() {return this.spec?.videoId?this.player?.getCurrentTime?.() || 0:this.local.currentTime;}
  get duration() {return this.spec?.videoId?this.player?.getDuration?.() || 0:this.local.duration;}
  setRange(start,end) {
    if(!this.spec)return;
    this.spec.start=start;this.spec.end=end;
    if(this.spec.videoId)this.player?.cueVideoById?.({videoId:this.spec.videoId,startSeconds:start,endSeconds:end});
    else if(this.local.readyState>0)this.local.currentTime=start;
  }

  load(spec) {
    if (this.spec?.key===spec?.key && !this.failed) return this.ready;
    this.pause();const generation=++this.generation;this.failed=false;
    this.player?.destroy();this.player=null;
    this.local.removeAttribute('src');this.local.load();
    this.spec=spec;
    this.local.hidden=Boolean(spec?.videoId);this.youtubeHost.hidden=!spec?.videoId;
    this.dock.classList.toggle('audio-only',Boolean(spec?.audioOnly));
    if (!spec) {this.dock.hidden=true;this.ready=Promise.resolve();return this.ready;}
    this.ready=this.connect(spec,generation).catch((error)=>{
      if (generation===this.generation) {this.failed=true;this.onState(false);this.onError(error.message);}
      throw error;
    });
    this.ready.catch(()=>{});
    return this.ready;
  }

  async connect(spec,generation) {
    if (spec.videoId) {
      const YT=await loadYoutubeAPI();
      if (generation!==this.generation) return;
      const mount=document.createElement('div');this.youtubeHost.replaceChildren(mount);
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('YouTube 플레이어를 열지 못했습니다. 원본 링크를 확인해 주세요.')),15000);
        this.player=new YT.Player(mount,{
          width:'100%',height:'220',videoId:spec.videoId,
          playerVars:{playsinline:1,rel:0,origin:location.origin,start:Math.floor(spec.start),end:Math.ceil(spec.end)},
          events:{
            onReady:(event)=>{
              clearTimeout(timeout);
              if(generation!==this.generation){event.target.destroy();resolve();return;}
              this.onDuration(event.target.getDuration(),spec.key);resolve();
            },
            onStateChange:(event)=>{if(generation===this.generation){this.onState(event.data===1);this.onDuration(event.target.getDuration(),spec.key);}},
            onError:()=>{clearTimeout(timeout);const error=new Error('이 YouTube 영상은 재생할 수 없습니다. 원본 링크를 열거나 다른 음원을 선택해 주세요.');if(generation===this.generation){this.failed=true;this.onState(false);this.onError(error.message);}reject(error);},
            onAutoplayBlocked:()=>{if(generation===this.generation){this.onState(false);this.onError('영상 안의 재생 버튼을 눌러 주세요.');}}
          }
        });
      });
    } else {
      await new Promise((resolve,reject)=>{
        const controller=new AbortController();
        const finish=(error)=>{clearTimeout(timeout);controller.abort();error?reject(error):resolve();};
        const timeout=setTimeout(()=>finish(new Error('음원을 불러오지 못했습니다. 파일이나 직접 재생 가능한 음원 주소를 확인해 주세요.')),15000);
        this.local.addEventListener('loadedmetadata',()=>{if(generation===this.generation){this.local.currentTime=Math.min(spec.start,this.local.duration);this.onDuration(this.local.duration,spec.key);}finish();},{once:true,signal:controller.signal});
        this.local.addEventListener('error',()=>finish(new Error('음원을 재생하지 못했습니다. 파일 형식 또는 음원 주소를 확인해 주세요.')),{once:true,signal:controller.signal});
        this.local.src=spec.url;this.local.load();
      });
    }
  }

  async play(start,end) {
    const request=++this.playRequest;
    await this.ready;
    if(request!==this.playRequest || !this.spec) return;
    const position=this.time>=start && this.time<end-0.1?this.time:start;
    if(this.spec.videoId) {
      this.player.loadVideoById({videoId:this.spec.videoId,startSeconds:position,endSeconds:end});
    } else {
      this.local.currentTime=position;
      try {await this.local.play();}
      catch(error){if(request===this.playRequest && error.name!=='AbortError')throw new Error('재생 버튼을 다시 누르거나 다른 음원을 선택해 주세요.');}
      if(request!==this.playRequest)this.local.pause();
    }
  }
}
