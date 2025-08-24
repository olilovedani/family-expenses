export function Button({ variant='', size='', className='', ...props }){
  const variants = {
    secondary: 'btn btn-secondary',
    destructive: 'btn btn-destructive',
    ghost: 'btn border-transparent bg-transparent hover:bg-slate-100',
    default: 'btn'
  }
  return <button className={`${variants[variant]||variants.default} ${className}`} {...props} />
}
