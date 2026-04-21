export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { seedEnvContracts } = await import('./lib/seed-env-contracts')
    await seedEnvContracts()
  }
}
