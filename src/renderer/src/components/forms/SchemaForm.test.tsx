import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SchemaForm } from './SchemaForm'

describe('SchemaForm', () => {
  it('renders text input for string property', () => {
    const schema = { type: 'object', properties: { name: { type: 'string', title: 'Name' } } }
    const { getByLabelText } = render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />)
    expect(getByLabelText('Name')).toBeInTheDocument()
    expect(getByLabelText('Name').tagName).toBe('INPUT')
  })

  it('renders password input for password format', () => {
    const schema = { type: 'object', properties: { secret: { type: 'string', title: 'Secret', format: 'password' } } }
    const { getByLabelText } = render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />)
    expect(getByLabelText('Secret')).toHaveAttribute('type', 'password')
  })

  it('renders select for enum property', () => {
    const schema = { type: 'object', properties: { model: { type: 'string', title: 'Model', enum: ['a', 'b'] } } }
    const { getByRole } = render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />)
    expect(getByRole('combobox')).toBeInTheDocument()
  })

  it('renders checkbox for boolean property', () => {
    const schema = { type: 'object', properties: { enabled: { type: 'boolean', title: 'Enabled' } } }
    const { getByRole } = render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />)
    expect(getByRole('checkbox')).toBeInTheDocument()
  })

  it('calls onChange when text input changes', () => {
    const onChange = vi.fn()
    const schema = { type: 'object', properties: { name: { type: 'string', title: 'Name' } } }
    const { getByLabelText } = render(<SchemaForm schema={schema} value={{}} onChange={onChange} />)
    fireEvent.change(getByLabelText('Name'), { target: { value: 'Alice' } })
    expect(onChange).toHaveBeenCalledWith({ name: 'Alice' })
  })

  it('calls onChange when select changes', () => {
    const onChange = vi.fn()
    const schema = { type: 'object', properties: { model: { type: 'string', title: 'Model', enum: ['a', 'b'] } } }
    const { getByRole } = render(<SchemaForm schema={schema} value={{}} onChange={onChange} />)
    fireEvent.change(getByRole('combobox'), { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalledWith({ model: 'b' })
  })

  it('shows required asterisk for required fields', () => {
    const schema = { type: 'object', required: ['name'], properties: { name: { type: 'string', title: 'Name' } } }
    const { getByText } = render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />)
    expect(getByText('*')).toBeInTheDocument()
  })
})
