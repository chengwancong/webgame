import {test,expect} from 'vitest';
import {loginPanelHtml} from '../apps/web/src/ui/auth-panels.ts';
import {loadAudioSettings,saveAudioSettings,defaultAudioSettings} from '../apps/web/src/audio/settings.ts';

test('标题静音按钮按已存主音量渲染，刷新后不回到“开”（UX-A-F01）',()=>{
 const store=new Map<string,string>();
 (globalThis as any).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>void store.set(k,v)};
 try{
  expect(loadAudioSettings().master).toBe(defaultAudioSettings.master);
  saveAudioSettings({...loadAudioSettings(),master:0});
  const muted=loadAudioSettings().master<=0;expect(muted).toBe(true);
  const html=loginPanelHtml(false,{ready:true,connecting:false,error:'',reload:false,muted});
  expect(html).toContain('aria-pressed="true">声音：关');
  saveAudioSettings({...loadAudioSettings(),master:.8});
  expect(loginPanelHtml(false,{ready:true,connecting:false,error:'',reload:false,muted:loadAudioSettings().master<=0})).toContain('aria-pressed="false">声音：开');
  expect(loginPanelHtml(false)).toContain('声音：开');
 }finally{delete (globalThis as any).localStorage;}
});
