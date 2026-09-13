'use client';
import {useState} from 'react';
import {Building2,Plus,ArrowRight,ArrowLeft,Pencil,Trash2} from 'lucide-react';
import {api,s,useData,State,SearchBox,Empty,Modal,Form,Confirm,saved,number} from './shared';
const institutionFields=[{key:'name',label:'Institution name'},{key:'short_name',label:'Short name'},{key:'type',label:'Institution type',options:['university','polytechnic']},{key:'state',label:'State',optional:true},{key:'city',label:'City',optional:true},{key:'website_url',label:'Website',type:'url',optional:true}];
const unitFields=[{key:'name',label:'Name'},{key:'code',label:'Code'}];
export default function Institutions({superAdmin}){
 const r=useData('/manage/institutions');const [search,setSearch]=useState('');const [type,setType]=useState('');const [selected,setSelected]=useState(null);const [editing,setEditing]=useState(null);const [remove,setRemove]=useState(null);
 const rows=(r.data||[]).filter(x=>(!type||x.type===type)&&`${x.name} ${x.short_name}`.toLowerCase().includes(search.toLowerCase()));
 return <><div className={s.heading}><div><small>ACADEMIC STRUCTURE</small><h1>Institution management</h1><p>Shared starter faculties, schools, departments and courses. Open an institution to edit its structure for your campus.</p></div><button className={s.primary} onClick={()=>setEditing({})}><Plus size={17}/> Add institution</button></div><section className={s.card}><div className={s.toolbar}><SearchBox value={search} onChange={setSearch} placeholder="Search institutions…"/><select value={type} aria-label="Institution type" onChange={e=>setType(e.target.value)}><option value="">All types</option><option value="university">Universities</option><option value="polytechnic">Polytechnics</option></select><span className={s.muted}>{rows.length} institutions</span></div><State resource={r}>{rows.length?<div className={s.tableWrap}><table><thead><tr><th>Institution</th><th>Type</th><th>Academic units</th><th>Academic items</th><th>Students</th><th>Actions</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><button className={s.entity} onClick={()=>setSelected(x)}><span className={s.icon}><Building2 size={20}/></span><span><b>{x.name}</b><small>{x.short_name} · {x.state||'State not set'}</small></span></button></td><td><span className={s.badge}>{x.type}</span></td><td>{number(x.academic_unit_count)}</td><td>{number(x.academic_item_count)}</td><td>{number(x.student_count)}</td><td><div className={s.actions}><button aria-label={`Edit ${x.name}`} onClick={()=>setEditing(x)}><Pencil size={16}/></button>{superAdmin&&<button aria-label={`Delete ${x.name}`} onClick={()=>setRemove(x)}><Trash2 size={16}/></button>}<button aria-label={`Open ${x.name}`} onClick={()=>setSelected(x)}><ArrowRight size={17}/></button></div></td></tr>)}</tbody></table></div>:<Empty>No institutions match. Add an institution to begin.</Empty>}</State></section>
 {editing&&<Modal title={editing.id?'Edit institution':'Add institution'} onClose={()=>setEditing(null)}><Form initial={{type:'university',...editing}} fields={institutionFields.map(f=>({...f,disabled:f.key==='type'&&!!editing.id}))} onCancel={()=>setEditing(null)} onSave={async values=>{if(editing.id)await api.patch('/manage/institutions/'+editing.id,values);else await api.post('/manage/institutions',values);saved();setEditing(null);r.reload();}}/></Modal>}
 {remove&&<Confirm title="Delete empty institution?" onClose={()=>setRemove(null)} onConfirm={async()=>{await api.delete('/manage/institutions/'+remove.id);saved('Institution deleted');r.reload();}}>Delete {remove.name}? Institutions with linked students or academic records cannot be deleted.</Confirm>}
 {selected&&<AcademicTree institution={selected} superAdmin={superAdmin} onClose={()=>{setSelected(null);r.reload();}}/>}</>;
}
function AcademicTree({institution,superAdmin,onClose}){
 const isPoly=institution.type==='polytechnic';
 const units=isPoly?'programmes':'faculties';

 const [trail,setTrail]=useState([]);
 const [editing,setEditing]=useState(null);
 const [remove,setRemove]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 const last=trail[trail.length-1];

 const kind=isPoly
   ? (trail.length===0?'programmes':'courses')
   : (trail.length===0?'faculties':trail.length===1?'departments':'courses');

 const url=isPoly
   ? (
       trail.length===0
         ? `/institutions/${institution.id}/programmes`
         : `/institutions/programmes/${last.id}/courses`
     )
   : (
       trail.length===0
         ? `/manage/institutions/${institution.id}/faculties`
         : trail.length===1
           ? `/manage/faculties/${last.id}/departments`
           : `/manage/departments/${last.id}/courses`
     );

 const r=useData(url);

 const fields=kind==='courses'
   ? [
       {key:'title',label:'Course title'},
       {key:'code',label:'Course code'},
       {
         key:'level',
         label:'Level',
         options:isPoly
           ? ['ND1','ND2','HND1','HND2']
           : ['100','200','300','400','500','600']
       },
       {
         key:'semester',
         label:'Semester',
         options:['first','second']
       },
       {
         key:'credit_units',
         label:'Credit units',
         type:'number',
         min:1,
         max:12
       }
     ]
   : kind==='programmes'
     ? [
         {key:'name',label:'Programme name'},
         {key:'award_type',label:'Award',options:['ND','HND']},
         {
           key:'accreditation_status',
           label:'Status',
           options:['accredited','interim','expired']
         }
       ]
     : unitFields;

 const canEditStructure=!isPoly || kind==='courses';

 const titleFor=x =>
   kind==='programmes'
     ? `${x.award_type} · ${x.name}`
     : (x.title||x.name);

 const subtitleFor=x => {
   if(kind==='programmes'){
     return x.accreditation_status || '';
   }

   if(kind==='courses'){
     return `${x.code||''}${x.level?` · ${x.level}`:''}${x.semester?` · ${x.semester} semester`:''}`;
   }

   return x.code||'';
 };

 return <Modal wide title={institution.name} onClose={onClose}>
   {editing
     ? <>
         <button
           className={s.textButton}
           onClick={()=>setEditing(null)}
         >
           <ArrowLeft size={16}/> Back to {kind}
         </button>

         <h3>
           {editing.id?'Edit':'Add'} {
             kind==='courses'
               ? 'course'
               : kind==='departments'
                 ? 'department'
                 : kind==='faculties'
                   ? 'faculty'
                   : 'programme'
           }
         </h3>

         <Form
           key={editing.id||'new'}
           initial={{semester:'first',credit_units:3,...editing}}
           fields={fields}
           onCancel={()=>setEditing(null)}
           onSave={async values=>{
             if(isPoly && kind==='programmes'){
               throw new Error('Programme editing is not enabled from this drawer yet.');
             }

             if(editing.id){
               await api.patch(`/manage/${kind}/${editing.id}`,values);
             }else{
               await api.post(url,values);
             }

             saved();
             setEditing(null);
             r.reload();
           }}
         />
       </>
     : remove
       ? <>
           <h3>Delete {remove.name||remove.title}?</h3>
           <p>
             Only empty records can be deleted. Linked students,
             courses or content will be preserved.
           </p>

           {error&&
             <p className={s.error} role="alert">
               {error}
             </p>
           }

           <div className={s.actions}>
             <button
               disabled={busy}
               onClick={()=>setRemove(null)}
             >
               Cancel
             </button>

             <button
               className={s.primary}
               disabled={busy}
               onClick={async()=>{
                 setBusy(true);
                 setError('');

                 try{
                   if(isPoly && kind==='programmes'){
                     throw new Error(
                       'Programme deletion is not enabled from this drawer yet.'
                     );
                   }

                   await api.delete(`/manage/${kind}/${remove.id}`);
                   saved('Record deleted');
                   setRemove(null);
                   r.reload();

                 }catch(e){
                   setError(
                     e.response?.data?.message||
                     e.message||
                     'Delete failed'
                   );
                 }finally{
                   setBusy(false);
                 }
               }}
             >
               {busy?'Deleting…':'Delete empty record'}
             </button>
           </div>
         </>
       : <>
           <div className={s.breadcrumb}>
             <button onClick={()=>setTrail([])}>
               {institution.short_name||institution.name}
             </button>

             {trail.map((x,i)=>
               <button
                 key={x.id}
                 onClick={()=>setTrail(trail.slice(0,i+1))}
               >
                 / {titleFor(x)}
               </button>
             )}
           </div>

           <div className={s.cardTitle}>
             <h3>
               {kind==='programmes'
                 ? 'Programmes'
                 : kind[0].toUpperCase()+kind.slice(1)}
             </h3>

             {canEditStructure&&
               <button
                 className={s.primary}
                 onClick={()=>setEditing({})}
               >
                 <Plus size={16}/> Add
               </button>
             }
           </div>

           {isPoly && kind==='programmes' &&
             <p className={s.muted}>
               Accredited and seeded ND/HND programmes for this institution.
               Open a programme to view its course catalogue.
             </p>
           }

           {kind==='courses' &&
             <p className={s.muted}>
               {isPoly
                 ? 'Programme courses may be generic starter courses or legacy mappings until verified curriculum data is added.'
                 : 'Courses beginning with KL- are editable starter defaults. Adjust titles, codes, levels, semesters and credit units to match this institution.'}
             </p>
           }

           <State resource={r}>
             {r.data?.length
               ? <div className={s.tree}>
                   {r.data.map(x=>
                     <div key={x.id}>
                       <button
                         className={s.entity}
                         disabled={kind==='courses'}
                         onClick={()=>setTrail([...trail,x])}
                       >
                         <span className={s.icon}>
                           <Building2 size={19}/>
                         </span>

                         <span>
                           <b>{titleFor(x)}</b>
                           <small>{subtitleFor(x)}</small>
                         </span>
                       </button>

                       <div className={s.actions}>
                         {(!isPoly || kind==='courses') &&
                           <button
                             aria-label={`Edit ${titleFor(x)}`}
                             onClick={()=>setEditing(x)}
                           >
                             <Pencil size={16}/>
                           </button>
                         }

                         {superAdmin && (!isPoly || kind==='courses') &&
                           <button
                             aria-label={`Delete ${titleFor(x)}`}
                             onClick={()=>{
                               setError('');
                               setRemove(x);
                             }}
                           >
                             <Trash2 size={16}/>
                           </button>
                         }

                         {kind!=='courses' &&
                           <button
                             aria-label={`Open ${titleFor(x)}`}
                             onClick={()=>setTrail([...trail,x])}
                           >
                             <ArrowRight size={18}/>
                           </button>
                         }
                       </div>
                     </div>
                   )}
                 </div>
               : <Empty>
                   No {kind} added here yet.
                 </Empty>
             }
           </State>
         </>
   }
 </Modal>;
}
