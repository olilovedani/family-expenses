import { useId, useState } from 'react'
export function Tabs({ defaultValue, children, className='' }){
  const [value, setValue] = useState(defaultValue)
  return <div className={className} data-value={value}>
    {Array.isArray(children)? children.map((c,i)=> (typeof c==='object' && c.type && c.type.displayName==='TabsList') ? 
      <c.type {...c.props} key={i} value={value} setValue={setValue}/> : c): children}
  </div>
}
export function TabsList({ children, value, setValue, className='' }){
  return <div className={`tabs-list ${className}`}>{Array.isArray(children)? children.map((c,i)=> <c.type key={i} {...c.props} activeValue={value} setValue={setValue}/>): children}</div>
}
TabsList.displayName='TabsList'
export function TabsTrigger({ value, children, activeValue, setValue }){
  return <button className="tabs-trigger" data-active={String(activeValue===value)} onClick={()=>setValue(value)}>{children}</button>
}
export function TabsContent({ value, children, className='', ...props }){
  return <div className={className} hidden={props['data-value']!==undefined ? props['data-value']!==value : undefined}>{children}</div>
}
Tabs.displayName='Tabs'; TabsList.displayName='TabsList'; TabsTrigger.displayName='TabsTrigger'; TabsContent.displayName='TabsContent';
