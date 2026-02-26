import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0FA4AF',  // Primary color
    },
    secondary: {
      main: '#024950',  // Secondary color
    },
  },
});

// Define types for the component props
interface Item {
  path: string; // Assuming the 'item' has a 'path' property of type string
}

interface MyComponentProps {
  currentPath: string; // currentPath is a string
  item: Item; // item is of type 'Item' which contains a 'path' property
}

const MyComponent: React.FC<MyComponentProps> = ({ currentPath, item }) => {
  return (
    <ThemeProvider theme={theme}>
      <div
        style={{
          backgroundColor: currentPath === item.path
            ? theme.palette.secondary.main
            : theme.palette.primary.main,
        }}
      >
        {/* Your content */}
      </div>
    </ThemeProvider>
  );
};

export default MyComponent;
