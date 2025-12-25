// Derived/computed state with reactive dependencies
// Demonstrates reactive computed values that update when dependencies change

import { createStore, derive } from '../../src'

// Base state interface
interface ShoppingCart {
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
  }>
  discount: number
  taxRate: number
}

// Initial cart state
const initialCart: ShoppingCart = {
  items: [
    { id: '1', name: 'Product A', price: 10, quantity: 2 },
    { id: '2', name: 'Product B', price: 25, quantity: 1 }
  ],
  discount: 10,
  taxRate: 8.25
}

const cartStore = createStore<ShoppingCart>(initialCart)

// 1. Derived state - total quantity (reactive to items changes)
const totalQuantity = derive(cartStore, (state) => 
  state.items.reduce((sum, item) => sum + item.quantity, 0)
)

// 2. Derived state - subtotal (reactive to items and quantity changes)
const subtotal = derive(cartStore, (state) =>
  state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
)

// 3. Derived state - discount amount (reactive to subtotal and discount changes)
const discountAmount = derive(cartStore, (state) => {
  const sub = state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  return sub * (state.discount / 100)
})

// 4. Derived state - tax amount (reactive to subtotal, discount, and tax changes)
const taxAmount = derive(cartStore, (state) => {
  const sub = state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const discounted = sub - (sub * (state.discount / 100))
  return discounted * (state.taxRate / 100)
})

// 5. Derived state - grand total (combines all derived values)
const grandTotal = derive(cartStore, (state) => {
  const sub = state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const discount = sub * (state.discount / 100)
  const taxed = (sub - discount) * (1 + state.taxRate / 100)
  return taxed
})

// Subscribe to derived values to see reactivity in action
console.log('Setting up derived state subscriptions...')

totalQuantity.subscribe((quantity) => {
  console.log('Total quantity changed:', quantity)
}, { fireImmediately: true })

subtotal.subscribe((amount) => {
  console.log('Subtotal changed:', amount.toFixed(2))
}, { fireImmediately: true })

grandTotal.subscribe((total) => {
  console.log('Grand total changed:', total.toFixed(2))
}, { fireImmediately: true })

// Demonstrate reactivity by updating the base state
console.log('\n--- Updating cart items ---')
cartStore.update((prev, newQuantity: number) => ({
  ...prev,
  items: prev.items.map(item => 
    item.id === '1' 
      ? { ...item, quantity: newQuantity }
      : item
  ) as { id: string; name: string; price: number; quantity: number }[]
}), 5)

console.log('\n--- Applying discount ---')
cartStore.update((prev, discount: number) => ({
  ...prev,
  discount,
  items: [...prev.items] as { id: string; name: string; price: number; quantity: number }[]
}), 15)

console.log('\n--- Changing tax rate ---')
cartStore.update((prev, taxRate: number) => ({
  ...prev,
  taxRate,
  items: [...prev.items] as { id: string; name: string; price: number; quantity: number }[]
}), 10)

// Read current derived values
console.log('\n--- Current derived values ---')
console.log('Total quantity:', totalQuantity.read())
console.log('Subtotal: $', subtotal.read().toFixed(2))
console.log('Discount: $', discountAmount.read().toFixed(2))
console.log('Tax: $', taxAmount.read().toFixed(2))
console.log('Grand total: $', grandTotal.read().toFixed(2))

// Performance note: Derived values are computed on-demand
// and only recompute when dependencies change