import {getLanguage, placeText} from "../../i18n/LanguageController.js";
import {CITIES, PLACES} from "../places.js";
import {profiles} from "./model.js";

export const say = (zh,en) => getLanguage() === "zh-CN" ? zh : en;
export const tx = pair => placeText(pair);
export const cityName = id => tx(CITIES[id].name);
export const siteName = id => tx(PLACES[id].name);
export const person = id => tx(profiles[id]);
export function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (v == null || (v === false && !k.startsWith("aria-"))) continue;
    if (k.startsWith("on")) element.addEventListener(k.slice(2),v);
    else if (k === "class") element.className = v;
    else element.setAttribute(k,v === true && !k.startsWith("aria-") ? "" : String(v));
  }
  element.append(...children.flat().filter(c => c != null && c !== false));
  return element;
}
export const btn = (label,handler,style = "",attrs = {}) => h("button",{type:"button",class:style,onclick:handler,...attrs},label);
export const row = (...children) => h("div",{class:"ex-actions"},...children);
export const para = text => h("p",{class:"ex-muted"},text);
export function field(title,control) {
  control.setAttribute("aria-label",title);
  return h("label",{class:"ex-field"},h("span",{},title),control);
}
export const group = (title,...body) => h("section",{class:"ex-section"},h("h3",{},title),...body);
export const select = (items,value,attrs={}) => {
  const control = h("select",attrs,...items.map(([id,name]) => h("option",{value:id},name)));
  if (value != null) control.value = value;
  return control;
};
export const options = choices => Object.entries(choices).map(([id,label]) => [id,tx(label)]);
export const cityOptions = () => Object.keys(CITIES).map(id => [id,cityName(id)]);
export const input = (type,value="",attrs={}) => h("input",{type,value,...attrs});
export const area = (value="",max=500,required=false) => h("textarea",{maxlength:max,rows:3,dir:"auto",required},value);
export const submit = title => h("button",{type:"submit",class:"ex-primary"},title);
export const form = (fn,...children) => h("form",{class:"ex-form",onsubmit:e => {e.preventDefault(); fn();}},...children);
export const hint = (tag, text) => h(tag,{class:"ex-hint"},text);
export function offerTitle(o) {
  if (o.theme) return o.theme;
  const place = siteName(CITIES[o.home].places[0]), city = cityName(o.home);
  return say("从" + place + "认识" + city,"Discover " + city + " through " + place);
}
export const offerMeta = o => person(o.owner) + (o.sample ? say(" · 示例邀请"," · Sample invitation") : "");
export const safeDate = value => value || say("日期待定","Date to be agreed");

// Localise the controls while keeping the visitor's unsubmitted words and selections.
export function relabelForm(root, paint) {
  const nodes = () => [...root.querySelectorAll("input,textarea,select")];
  const fields = nodes().map(e => ({type:e.type,value:e.value,checked:e.checked}));
  const open = [...root.querySelectorAll("details")].map(d => d.open);
  paint();
  [...root.querySelectorAll("details")].forEach((d,i) => { d.open = Boolean(open[i]); });
  nodes().forEach((e,i) => {
    const old = fields[i];
    if (!old || old.type !== e.type) return;
    if (e.type === "checkbox" || e.type === "radio") e.checked = old.checked;
    else if (e.value !== old.value) {
      e.value = old.value;
      if (e.tagName === "SELECT") e.dispatchEvent(new Event("change"));
    }
  });
}
