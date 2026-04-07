// src/utils/validators.ts

// Validate if a value is a number
export const isNumber = (value: string | number): boolean => {
  return !isNaN(Number(value));
};

// Validate if a value is a string
export const isString = (value: any): boolean => {
  return typeof value === 'string';
};

// Validate if a value is not empty
export const isNotEmpty = (value: any): boolean => {
  return value !== undefined && value !== null && value !== '';
};

// Validate if a number is only a number
export const validateNumber = (value: any): string | undefined => {
  if (!isNotEmpty(value)) {
    return 'Value should not be empty';
  }
  if (!isNumber(value)) {
    return 'Value should be a number';
  }

  return undefined;
};

// Validate if a string is only a string
export const validateString = (value: any): string | undefined => {
  if (!isNotEmpty(value)) {
    return 'Value should not be empty';
  }
  if (!isString(value)) {
    return 'Value should be a string';
  }
  return undefined;
};

// Validate if a category name is valid
export const validateCategoryName = (name: string, existingNames: string[], caseSensitive = true): string | undefined => {
  if (!isNotEmpty(name)) {
    return 'Category name cannot be empty';
  }

  if (isNumber(name)) {
    return 'Category name cannot be a number';
  }

  const formattedName = caseSensitive ? name.trim() : name.trim().toLowerCase();
  const duplicateExists = existingNames.some(existingName =>
    caseSensitive ? existingName === formattedName : existingName.toLowerCase() === formattedName
  );

  if (duplicateExists) {
    return 'Category name already exists';
  }

  return undefined;
};
