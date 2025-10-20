export type Chore={id:string;title:string;rewardPence:number;stars:number}
export function ChoreCard({chore,onMarkDone}:{chore:Chore;onMarkDone:(id:string)=>void}){
  return (<div className='rounded-2xl p-4 border border-white/20 bg-white/10'>
    <div className='font-semibold'>{chore.title}</div>
    <div className='opacity-80 text-sm'>£{(chore.rewardPence/100).toFixed(2)} + {chore.stars}⭐</div>
    <button className='mt-2 px-3 py-2 rounded-xl bg-amber-400 text-slate-900' onClick={()=>onMarkDone(chore.id)}>Mark Done</button>
  </div>)
}
