// Keep live controls, images and scroll containers when only their content changes.
function syncNode(current:Node,next:Node){
 if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName){current.parentNode!.replaceChild(next.cloneNode(true),current);return;}
 if(current.nodeType===Node.TEXT_NODE||current.nodeType===Node.COMMENT_NODE){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
 if(!(current instanceof Element)||!(next instanceof Element))return;
 for(const attribute of Array.from(current.attributes))if(!next.hasAttribute(attribute.name))current.removeAttribute(attribute.name);
 for(const attribute of Array.from(next.attributes))if(current.getAttribute(attribute.name)!==attribute.value)current.setAttribute(attribute.name,attribute.value);
 syncChildren(current,next);
 if(current instanceof HTMLInputElement&&next instanceof HTMLInputElement){if(current.value!==next.value)current.value=next.value;current.checked=next.checked;}
 if(current instanceof HTMLSelectElement&&next instanceof HTMLSelectElement&&current.value!==next.value)current.value=next.value;
}
function syncChildren(current:Node,next:Node){
 const before=Array.from(current.childNodes),after=Array.from(next.childNodes);
 for(let index=0;index<after.length;index++){
  if(before[index])syncNode(before[index],after[index]);else current.appendChild(after[index].cloneNode(true));
 }
 for(let index=after.length;index<before.length;index++)current.removeChild(before[index]);
}
export function syncMarkup(root:HTMLElement,markup:string){const template=document.createElement('template');template.innerHTML=markup;syncChildren(root,template.content);}
