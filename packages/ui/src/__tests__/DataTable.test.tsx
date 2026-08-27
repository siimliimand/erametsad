import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable, type Column } from '../components/DataTable'

interface TestRow extends Record<string, unknown> {
  name: string
  age: number
}

const columns: Column<TestRow>[] = [
  { key: 'name', label: 'Nimi', sortable: true },
  { key: 'age', label: 'Vanus', sortable: true },
]

const data: TestRow[] = [
  { name: 'Mari', age: 30 },
  { name: 'Jüri', age: 25 },
  { name: 'Aino', age: 45 },
]

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Nimi')).toBeDefined()
    expect(screen.getByText('Vanus')).toBeDefined()
  })

  it('renders data rows', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Mari')).toBeDefined()
    expect(screen.getByText('Jüri')).toBeDefined()
    expect(screen.getByText('Aino')).toBeDefined()
  })

  it('renders empty state when no data', () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByText('Andmeid pole')).toBeDefined()
  })

  it('renders custom empty state', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyState={<span>Test empty</span>}
      />,
    )
    expect(screen.getByText('Test empty')).toBeDefined()
  })

  it('calls onSort with ascending direction on first click', () => {
    const onSort = vi.fn()
    render(
      <DataTable columns={columns} data={data} sortable onSort={onSort} />,
    )

    fireEvent.click(screen.getByText('Nimi'))

    expect(onSort).toHaveBeenCalledWith('name', 'asc')
  })

  it('calls onSort with descending on second click', () => {
    const onSort = vi.fn()
    render(
      <DataTable columns={columns} data={data} sortable onSort={onSort} />,
    )

    fireEvent.click(screen.getByText('Nimi'))
    fireEvent.click(screen.getByText('Nimi'))

    expect(onSort).toHaveBeenCalledWith('name', 'desc')
  })

  it('renders pagination controls', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        page={2}
        totalPages={5}
        onPageChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Eelmine')).toBeDefined()
    expect(screen.getByText('Järgmine')).toBeDefined()
    expect(screen.getByText('Lehekülg 2 / 5')).toBeDefined()
  })

  it('calls onPageChange with next page', () => {
    const onPageChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        page={2}
        totalPages={5}
        onPageChange={onPageChange}
      />,
    )

    fireEvent.click(screen.getByText('Järgmine'))

    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('calls onPageChange with previous page', () => {
    const onPageChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        page={2}
        totalPages={5}
        onPageChange={onPageChange}
      />,
    )

    fireEvent.click(screen.getByText('Eelmine'))

    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('disables previous button on first page', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        page={1}
        totalPages={3}
        onPageChange={vi.fn()}
      />,
    )

    const prevBtn = screen.getByText('Eelmine')
    expect(prevBtn).toHaveProperty('disabled', true)
  })

  it('disables next button on last page', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        page={3}
        totalPages={3}
        onPageChange={vi.fn()}
      />,
    )

    const nextBtn = screen.getByText('Järgmine')
    expect(nextBtn).toHaveProperty('disabled', true)
  })

  it('does not render pagination when totalPages is 1', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.queryByText('Eelmine')).toBeNull()
    expect(screen.queryByText('Järgmine')).toBeNull()
  })

  it('renders loading skeleton rows', () => {
    render(<DataTable columns={columns} data={data} isLoading />)
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(6)
  })

  it('filters data by filter values', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        filters={{ name: 'Mari' }}
      />,
    )

    expect(screen.getByText('Mari')).toBeDefined()
    expect(screen.queryByText('Jüri')).toBeNull()
    expect(screen.queryByText('Aino')).toBeNull()
  })

  it('renders custom column values via render function', () => {
    const cols: Column<TestRow>[] = [
      {
        key: 'name',
        label: 'Nimi',
        render: (row) => <strong>{row.name}</strong>,
      },
    ]
    render(<DataTable columns={cols} data={data} />)
    const strong = screen.getByText('Mari')
    expect(strong.tagName).toBe('STRONG')
  })
})
