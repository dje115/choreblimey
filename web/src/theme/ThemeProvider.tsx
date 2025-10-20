export type Role='parent_admin'|'parent_viewer'|'relative_contributor'|'child_player'
export type Age='kid_5_8'|'tween_9_11'|'teen_12_15'|null
export function themeKey(role:Role,age:Age){
  if(role.startsWith('parent')) return 'parent'
  if(role==='relative_contributor') return 'relative'
  if(role==='child_player' && age==='teen_12_15') return 'child_teen'
  return 'child_kid'
}
