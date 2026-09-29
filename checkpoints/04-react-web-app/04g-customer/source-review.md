# Checkpoint 4g — Customer Page: Source Review

## Source Review: `src/app/(app)/customer/page.tsx` + `src/components/Customer.tsx`

### Page: `src/app/(app)/customer/page.tsx`

**Data fetched:**
- Customers list (all customers for current org)

**Features:**
- Table with customer list
- Search/filter
- Add/edit/delete customer dialog
- Shows customer code, name, email, phone, credit limit

### Components

#### `Customer.tsx`
- CustomerDialog for add/edit
- CustomerTable with search

### Bugs/Assumptions

1. Customer list is not paginated
2. Search is client-side
