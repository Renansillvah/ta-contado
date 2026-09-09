const token = process.env.SUPABASE_ACCESS_TOKEN

async function main() {
  // Testa o token contra a API de projetos do Supabase
  const res = await fetch('https://api.supabase.com/v1/projects', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  console.log('STATUS:', res.status)
  const text = await res.text()
  console.log('BODY:', text.slice(0, 800))
}

main().catch(e => console.error('ERR', e.message))
