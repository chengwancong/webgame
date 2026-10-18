#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform int u_kind;
out vec4 outColor;
void main(){
 vec2 p=v_uv*2.-1.;float mask;
 if(u_kind==2){mask=(1.-smoothstep(.7,.8,abs(p.x)))*(1.-smoothstep(.85,.95,abs(p.y)));float flow=.5+.5*sin(p.y*26.+u_time*6.+sin(p.x*12.));float foam=smoothstep(.45,.92,p.y)*(.5+.5*sin(p.x*24.+u_time*4.));vec3 color=mix(vec3(.3,.65,.71),vec3(.85,.96,.94),flow*.4+foam*.5);outColor=vec4(color,mask*.88);return;}
 mask=1.-smoothstep(.95,1.,abs(p.x)+abs(p.y)*1.111111);
 float ripple=sin(p.x*15.+p.y*8.+u_time*2.)*.04+sin(p.x*7.-p.y*12.-u_time)*.025;
 vec3 deep=vec3(.20,.49,.60),shallow=vec3(.55,.74,.70),light=vec3(.80,.91,.83);
 vec3 base=u_kind==1?shallow:deep;vec3 color=mix(base,light,smoothstep(.045,.065,ripple)*.4);
 outColor=vec4(color,mask*.9);
}
