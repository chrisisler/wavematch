const match = require('./')

const factorial = match({
    0: () => 1
    , default: (n) => n * factorial(n - 1)
})

console.log(
    factorial(4)
)
