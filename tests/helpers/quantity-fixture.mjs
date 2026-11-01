import Engine from '../../js/Engine.js';
import {JointSolver} from '../../js/JointSolver.js';
export const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
export function fixture({points=rect(0,0,4,3),openings=[],inputs={}}={}){
  const values={cfg_pW:'100',cfg_gW:'0',cfg_wGap:'0',cfg_maxL:'6',cfg_maxTrans:'12',cfg_dir:'90',cfg_minCut:'200',cfg_cX:'1',cfg_tY:'1',cfg_carrierL:'3',cfg_waste:'0',cfg_hangerL:'0.9',cfg_rodMode:'DIRECT',cfg_rodStock:'3',cfg_anchorZ:'3900',cfg_ceilingZ:'3000',cfg_rodAdjust:'0',cfg_calcMode:'EXACT',cfg_joint_pattern:'DEFAULT',cfg_joint_shift:'50',projectName:'Audit A',plan_hole_scope:'VOID',plan_circle_radius:'300',...inputs};
  const els={},el=id=>els[id]||={id,value:values[id]??'',style:{},classList:{add(){},remove(){},toggle(){}},textContent:'',innerHTML:'',setAttribute(){},addEventListener(){},focus(){}};Object.keys(values).forEach(el);
  globalThis.document={getElementById:el,querySelector:()=>el('root'),querySelectorAll:s=>s==='input[id],select[id]'?Object.values(els):[],createElement:()=>el('created')};
  globalThis.window={addEventListener(){}};globalThis.localStorage={setItem(){},getItem(){return null;}};
  const app=Object.create(Engine.prototype);app.state={points:structuredClone(points),openings:structuredClone(openings),inputMode:'FREE',mode:'IDLE',strips:[],edges:[],carriers:[],hangers:[],carrierJoints:[],warnings:[],projectZones:[],activeZoneId:null,editingIndex:null,jointConfig:{pattern:'DEFAULT',patternShift:.5},manualJointsMap:{},panX:0,panY:0,scale:80,CMD:{}};
  app.cont={onmousedown(){},onmousemove(){},onmouseup(){}};app.cvs={};app.jointSolver=new JointSolver();app.currentPreset={name:'AUDIT-100',color:'#fff'};app.draw=()=>{};app.centerView=()=>{};app.autoSave=()=>{};app.renderProjectList=()=>{};app.showFeedback=()=>{};app.syncEdges();app.calculate();return {app,el};
}
