import {tokenNames,tokenValues,type TokenName} from './src/ui/tokens.ts';

// Custom properties cannot be evaluated in media query conditions by browsers.
// Resolve conditions at build/dev transform time from the same generated tokens.
export function tokenMedia(){
 const values=new Map(Object.entries(tokenNames).map(([name,cssName])=>[cssName,tokenValues.dark[name as TokenName]]));
 return {postcssPlugin:'token-media-conditions',AtRule:{media(rule:{params:string}){
  rule.params=rule.params.replace(/var\((--[\w-]+)\)/g,(_,name)=>{
   const value=values.get(name);if(!value)throw Error('Unknown media token '+name);return value;
  });
 }}};
}
