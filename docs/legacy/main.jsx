import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=421cd3dc"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=421cd3dc"; const StrictMode = __vite__cjsImport1_react["StrictMode"];
import __vite__cjsImport2_reactDom_client from "/node_modules/.vite/deps/react-dom_client.js?v=a29d7e0e"; const createRoot = __vite__cjsImport2_reactDom_client["createRoot"];
import "/src/index.css";
import App from "/src/App.jsx";
import { ChakraProvider } from "/node_modules/.vite/deps/@chakra-ui_react.js?v=421cd3dc";
import { ColorModeProvider } from "/src/components/ui/color-mode.jsx";
import { Toaster } from "/src/components/ui/toaster.jsx";
import { QueryClient, QueryClientProvider } from "/node_modules/.vite/deps/@tanstack_react-query.js?v=d12c323b";
import { ReactQueryDevtools } from "/node_modules/@tanstack/react-query-devtools/build/modern/index.js?v=03cded86";
import { ErrorBoundary } from "/node_modules/.vite/deps/react-error-boundary.js?v=8bfd1681";
import loggingError from "/src/utils/services/loggingError.jsx";
import ErrorPage from "/src/pages/error/ErrorPage.jsx";
import reportWebVitals from "/src/reportWebVitals.jsx";
import { system } from "/src/theme/index.js";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * (60 * 1e3),
      cacheTime: 10 * (60 * 1e3),
      retry: (failureCount, error) => {
        if (error?.response?.status === 401 || error?.response?.status === 403) return false;
        return failureCount < 1;
      }
    }
  }
});
createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxDEV(StrictMode, { children: /* @__PURE__ */ jsxDEV(ChakraProvider, { value: system, children: /* @__PURE__ */ jsxDEV(QueryClientProvider, { client: queryClient, children: [
    /* @__PURE__ */ jsxDEV(ErrorBoundary, { FallbackComponent: ErrorPage, onError: loggingError, children: /* @__PURE__ */ jsxDEV(ColorModeProvider, { children: [
      /* @__PURE__ */ jsxDEV(Toaster, {}, void 0, false, {
        fileName: "/home/froadmin/radya-playground/fro-mes-js/fro-mes-frontend-js/src/main.jsx",
        lineNumber: 35,
        columnNumber: 13
      }),
      /* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
        fileName: "/home/froadmin/radya-playground/fro-mes-js/fro-mes-frontend-js/src/main.jsx",
        lineNumber: 36,
        columnNumber: 13
      })
    ] }, void 0, true, {
      fileName: "/home/froadmin/radya-playground/fro-mes-js/fro-mes-frontend-js/src/main.jsx",
      lineNumber: 34,
      columnNumber: 11
    }) }, void 0, false, {
      fileName: "/home/froadmin/radya-playground/fro-mes-js/fro-mes-frontend-js/src/main.jsx",
      lineNumber: 33,
      columnNumber: 9
    }),
    /* @__PURE__ */ jsxDEV(ReactQueryDevtools, { initialIsOpen: false }, void 0, false, {
      fileName: "/home/froadmin/radya-playground/fro-mes-js/fro-mes-frontend-js/src/main.jsx",
      lineNumber: 39,
      columnNumber: 9
    })
  ] }, void 0, true, {
    fileName: "/home/froadmin/radya-playground/fro-mes-js/fro-mes-frontend-js/src/main.jsx",
    lineNumber: 32,
    columnNumber: 7
  }) }, void 0, false, {
    fileName: "/home/froadmin/radya-playground/fro-mes-js/fro-mes-frontend-js/src/main.jsx",
    lineNumber: 31,
    columnNumber: 5
  }) }, void 0, false, {
    fileName: "/home/froadmin/radya-playground/fro-mes-js/fro-mes-frontend-js/src/main.jsx",
    lineNumber: 30,
    columnNumber: 3
  })
);
reportWebVitals();

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBa0NZO0FBbENaLFNBQVNBLGtCQUFrQjtBQUMzQixTQUFTQyxrQkFBa0I7QUFDM0IsT0FBTztBQUNQLE9BQU9DLFNBQVM7QUFDaEIsU0FBU0Msc0JBQXNCO0FBQy9CLFNBQVNDLHlCQUF5QjtBQUNsQyxTQUFTQyxlQUFlO0FBQ3hCLFNBQVNDLGFBQWFDLDJCQUEyQjtBQUNqRCxTQUFTQywwQkFBMEI7QUFDbkMsU0FBU0MscUJBQXFCO0FBQzlCLE9BQU9DLGtCQUFrQjtBQUN6QixPQUFPQyxlQUFlO0FBQ3RCLE9BQU9DLHFCQUFxQjtBQUM1QixTQUFTQyxjQUFjO0FBRXZCLE1BQU1DLGNBQWMsSUFBSVIsWUFBWTtBQUFBLEVBQ2xDUyxnQkFBZ0I7QUFBQSxJQUNkQyxTQUFTO0FBQUEsTUFDUEMsV0FBVyxLQUFLLEtBQUs7QUFBQSxNQUNyQkMsV0FBVyxNQUFNLEtBQUs7QUFBQSxNQUN0QkMsT0FBT0EsQ0FBQ0MsY0FBY0MsVUFBVTtBQUM5QixZQUFJQSxPQUFPQyxVQUFVQyxXQUFXLE9BQU9GLE9BQU9DLFVBQVVDLFdBQVcsSUFBSyxRQUFPO0FBQy9FLGVBQU9ILGVBQWU7QUFBQSxNQUN4QjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQztBQUVEbkIsV0FBV3VCLFNBQVNDLGVBQWUsTUFBTSxDQUFDLEVBQUVDO0FBQUFBLEVBQzFDLHVCQUFDLGNBQ0MsaUNBQUMsa0JBQWUsT0FBT2IsUUFDckIsaUNBQUMsdUJBQW9CLFFBQVFDLGFBQzNCO0FBQUEsMkJBQUMsaUJBQWMsbUJBQW1CSCxXQUFXLFNBQVNELGNBQ3BELGlDQUFDLHFCQUNDO0FBQUEsNkJBQUMsYUFBRDtBQUFBO0FBQUE7QUFBQTtBQUFBLE9BQVE7QUFBQSxNQUNSLHVCQUFDLFNBQUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxPQUFJO0FBQUEsU0FGTjtBQUFBO0FBQUE7QUFBQTtBQUFBLEtBR0EsS0FKRjtBQUFBO0FBQUE7QUFBQTtBQUFBLEtBS0E7QUFBQSxJQUNBLHVCQUFDLHNCQUFtQixlQUFlLFNBQW5DO0FBQUE7QUFBQTtBQUFBO0FBQUEsS0FBeUM7QUFBQSxPQVAzQztBQUFBO0FBQUE7QUFBQTtBQUFBLEdBUUEsS0FURjtBQUFBO0FBQUE7QUFBQTtBQUFBLEdBVUEsS0FYRjtBQUFBO0FBQUE7QUFBQTtBQUFBLEdBWUE7QUFDRjtBQUVBRSxnQkFBZ0IiLCJuYW1lcyI6WyJTdHJpY3RNb2RlIiwiY3JlYXRlUm9vdCIsIkFwcCIsIkNoYWtyYVByb3ZpZGVyIiwiQ29sb3JNb2RlUHJvdmlkZXIiLCJUb2FzdGVyIiwiUXVlcnlDbGllbnQiLCJRdWVyeUNsaWVudFByb3ZpZGVyIiwiUmVhY3RRdWVyeURldnRvb2xzIiwiRXJyb3JCb3VuZGFyeSIsImxvZ2dpbmdFcnJvciIsIkVycm9yUGFnZSIsInJlcG9ydFdlYlZpdGFscyIsInN5c3RlbSIsInF1ZXJ5Q2xpZW50IiwiZGVmYXVsdE9wdGlvbnMiLCJxdWVyaWVzIiwic3RhbGVUaW1lIiwiY2FjaGVUaW1lIiwicmV0cnkiLCJmYWlsdXJlQ291bnQiLCJlcnJvciIsInJlc3BvbnNlIiwic3RhdHVzIiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsInJlbmRlciJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJtYWluLmpzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdHJpY3RNb2RlIH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgY3JlYXRlUm9vdCB9IGZyb20gJ3JlYWN0LWRvbS9jbGllbnQnO1xuaW1wb3J0ICcuL2luZGV4LmNzcyc7XG5pbXBvcnQgQXBwIGZyb20gJy4vQXBwLmpzeCc7XG5pbXBvcnQgeyBDaGFrcmFQcm92aWRlciB9IGZyb20gJ0BjaGFrcmEtdWkvcmVhY3QnO1xuaW1wb3J0IHsgQ29sb3JNb2RlUHJvdmlkZXIgfSBmcm9tICdAL2NvbXBvbmVudHMvdWkvY29sb3ItbW9kZSc7XG5pbXBvcnQgeyBUb2FzdGVyIH0gZnJvbSAnQC9jb21wb25lbnRzL3VpL3RvYXN0ZXInO1xuaW1wb3J0IHsgUXVlcnlDbGllbnQsIFF1ZXJ5Q2xpZW50UHJvdmlkZXIgfSBmcm9tICdAdGFuc3RhY2svcmVhY3QtcXVlcnknO1xuaW1wb3J0IHsgUmVhY3RRdWVyeURldnRvb2xzIH0gZnJvbSAnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5LWRldnRvb2xzJztcbmltcG9ydCB7IEVycm9yQm91bmRhcnkgfSBmcm9tICdyZWFjdC1lcnJvci1ib3VuZGFyeSc7XG5pbXBvcnQgbG9nZ2luZ0Vycm9yIGZyb20gJy4vdXRpbHMvc2VydmljZXMvbG9nZ2luZ0Vycm9yJztcbmltcG9ydCBFcnJvclBhZ2UgZnJvbSAnLi9wYWdlcy9lcnJvci9FcnJvclBhZ2UnO1xuaW1wb3J0IHJlcG9ydFdlYlZpdGFscyBmcm9tICcuL3JlcG9ydFdlYlZpdGFscyc7XG5pbXBvcnQgeyBzeXN0ZW0gfSBmcm9tICcuL3RoZW1lJztcblxuY29uc3QgcXVlcnlDbGllbnQgPSBuZXcgUXVlcnlDbGllbnQoe1xuICBkZWZhdWx0T3B0aW9uczoge1xuICAgIHF1ZXJpZXM6IHtcbiAgICAgIHN0YWxlVGltZTogNSAqICg2MCAqIDEwMDApLFxuICAgICAgY2FjaGVUaW1lOiAxMCAqICg2MCAqIDEwMDApLFxuICAgICAgcmV0cnk6IChmYWlsdXJlQ291bnQsIGVycm9yKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcj8ucmVzcG9uc2U/LnN0YXR1cyA9PT0gNDAxIHx8IGVycm9yPy5yZXNwb25zZT8uc3RhdHVzID09PSA0MDMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZhaWx1cmVDb3VudCA8IDE7XG4gICAgICB9XG4gICAgfVxuICB9XG59KTtcblxuY3JlYXRlUm9vdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncm9vdCcpKS5yZW5kZXIoXG4gIDxTdHJpY3RNb2RlPlxuICAgIDxDaGFrcmFQcm92aWRlciB2YWx1ZT17c3lzdGVtfT5cbiAgICAgIDxRdWVyeUNsaWVudFByb3ZpZGVyIGNsaWVudD17cXVlcnlDbGllbnR9PlxuICAgICAgICA8RXJyb3JCb3VuZGFyeSBGYWxsYmFja0NvbXBvbmVudD17RXJyb3JQYWdlfSBvbkVycm9yPXtsb2dnaW5nRXJyb3J9PlxuICAgICAgICAgIDxDb2xvck1vZGVQcm92aWRlcj5cbiAgICAgICAgICAgIDxUb2FzdGVyIC8+XG4gICAgICAgICAgICA8QXBwIC8+XG4gICAgICAgICAgPC9Db2xvck1vZGVQcm92aWRlcj5cbiAgICAgICAgPC9FcnJvckJvdW5kYXJ5PlxuICAgICAgICA8UmVhY3RRdWVyeURldnRvb2xzIGluaXRpYWxJc09wZW49e2ZhbHNlfSAvPlxuICAgICAgPC9RdWVyeUNsaWVudFByb3ZpZGVyPlxuICAgIDwvQ2hha3JhUHJvdmlkZXI+XG4gIDwvU3RyaWN0TW9kZT5cbik7XG5cbnJlcG9ydFdlYlZpdGFscygpO1xuIl0sImZpbGUiOiIvaG9tZS9mcm9hZG1pbi9yYWR5YS1wbGF5Z3JvdW5kL2Zyby1tZXMtanMvZnJvLW1lcy1mcm9udGVuZC1qcy9zcmMvbWFpbi5qc3gifQ==