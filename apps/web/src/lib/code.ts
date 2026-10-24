export function generateCode(prefix: string): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return `${prefix}-${code}`;
}

export function generateCustomerCode(): string {
  const characters = "0123456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return `CUST-${code}`;
}

export function generateSupplierCode(): string {
  const characters = "0123456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return `SUPP-${code}`;
}


