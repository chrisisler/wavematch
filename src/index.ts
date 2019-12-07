type Branch = (...args: unknown[]) => unknown

const wavematch = (...args: unknown[]) => (
  ...blocks: Branch[]
): ReturnType<Branch> => {
  const f = 3
  return blocks[0](...args)
}

export default wavematch
module.exports = wavematch
