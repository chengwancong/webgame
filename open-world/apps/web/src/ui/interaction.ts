function syncTabOrientation(list:HTMLElement){const axis=getComputedStyle(list).getPropertyValue('--tabs-direction').trim(),orientation=axis?(axis==='column'?'vertical':'horizontal'):list.dataset.tabsOrientation??'horizontal';list.setAttribute('aria-orientation',orientation);return orientation;}
/** Keep screen-reader orientation and arrow keys aligned with responsive tab placement. */
export function observeUITabOrientation(root:HTMLElement){
 const sync=()=>root.querySelectorAll<HTMLElement>('[data-ui=tabs]').forEach(syncTabOrientation);let scheduled=false;
 const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;sync();});};
 const observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});window.addEventListener('resize',schedule);sync();
 return ()=>{observer.disconnect();window.removeEventListener('resize',schedule);};
}
/** Roving focus leaves actual selection to the owning action. */
export function handleUITabKey(event:KeyboardEvent):boolean{
 if(!(event.target instanceof HTMLElement)||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return false;
 const list=event.target.closest<HTMLElement>('[data-ui=tabs]');if(!list)return false;const vertical=syncTabOrientation(list)==='vertical';if(!['Home','End',...(vertical?['ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight'])].includes(event.key))return false;
 const buttons=Array.from(list.querySelectorAll<HTMLButtonElement>('button[role=tab]:not([disabled])'));
 if(!buttons.length)return false;event.preventDefault();
 const index=buttons.indexOf(event.target.closest<HTMLButtonElement>('button')!),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(Math.max(0,index)+(event.key==='ArrowRight'||event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
 const button=buttons[next],action=button.dataset.action,id=button.dataset.id;button.focus({preventScroll:true});button.click();
 requestAnimationFrame(()=>{const target=Array.from(document.querySelectorAll<HTMLElement>('[data-ui=tabs] button')).find(node=>node.dataset.action===action&&node.dataset.id===id);target?.focus({preventScroll:true});if(target){const parent=target.closest<HTMLElement>('[data-ui=tabs]')!,r=target.getBoundingClientRect(),p=parent.getBoundingClientRect();if(r.left<p.left)parent.scrollLeft-=p.left-r.left;if(r.right>p.right)parent.scrollLeft+=r.right-p.right;if(r.top<p.top)parent.scrollTop-=p.top-r.top;if(r.bottom>p.bottom)parent.scrollTop+=r.bottom-p.bottom;}});
 return true;
}
/** Inline validation uses a reserved hint slot, never a new row inserted below the field. */
export function setFieldFeedback(input:HTMLInputElement,message=''){
 const field=input.closest<HTMLElement>('[data-ui=field]'),hint=field?.querySelector<HTMLElement>('.ui-field__hint');if(!field||!hint)return;
 input.setAttribute('aria-invalid',String(Boolean(message)));hint.textContent=message||hint.dataset.defaultHint||'';hint.classList.toggle('ui-text-danger',Boolean(message));
 if(message)hint.setAttribute('role','alert');else hint.removeAttribute('role');
}
export function handleUIDialogKey(event:KeyboardEvent):boolean{
 const dialog=document.querySelector<HTMLElement>('[data-ui=confirmation] .ui-confirm');if(!dialog)return false;
 if(event.key==='Escape'){event.preventDefault();dialog.querySelector<HTMLButtonElement>('[data-ui-dialog-cancel]')?.click();return true;}
 if(event.key!=='Tab')return false;event.preventDefault();const buttons=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]')).filter(n=>n.tabIndex>=0&&n.getBoundingClientRect().height>0);if(!buttons.length)return true;
 const at=buttons.indexOf(document.activeElement as HTMLElement),next=event.shiftKey?(at<=0?buttons.length-1:at-1):(at+1)%buttons.length;buttons[next].focus({preventScroll:true});return true;
}
