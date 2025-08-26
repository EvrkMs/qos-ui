import React, { useState, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Button
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Save as SaveIcon
} from '@mui/icons-material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const columns = [
  { id: 'hive', label: 'Hive', minWidth: 60 },
  { id: 'regView', label: 'View', minWidth: 60 },
  { id: 'Rule', label: 'Rule Name', minWidth: 150 },
  { id: 'ApplicationName', label: 'Application', minWidth: 200 },
  { id: 'DSCPValue', label: 'DSCP', minWidth: 80 },
  { id: 'ThrottleRate', label: 'Throttle Rate', minWidth: 120 },
  { id: 'Protocol', label: 'Protocol', minWidth: 80 },
  { id: 'LocalIP', label: 'Local IP', minWidth: 120 },
  { id: 'LocalPort', label: 'Local Port', minWidth: 100 },
  { id: 'RemoteIP', label: 'Remote IP', minWidth: 120 },
  { id: 'RemotePort', label: 'Remote Port', minWidth: 100 },
  { id: 'actions', label: 'Actions', minWidth: 100 },
];

function formatPolicyValue(value, columnId) {
  // Для regView всегда показываем значение
  if (columnId === 'regView') {
    return <Chip label={`${value}-bit`} size="small" color={value === '64' ? 'primary' : 'secondary'} />;
  }
  
  // Для DSCP показываем значение или Any
  if (columnId === 'DSCPValue') {
    if (!value || value === '0' || value === '') {
      return <Chip label="Any" size="small" variant="outlined" />;
    }
    return <Chip label={`DSCP ${value}`} size="small" color="success" />;
  }
  
  // Для ThrottleRate показываем значение или Unlimited
  if (columnId === 'ThrottleRate') {
    if (!value || value === '0' || value === '' || value === '-1') {
      return <Chip label="Unlimited" size="small" variant="outlined" color="success" />;
    }
    return <Chip label={`${value} Kbps`} size="small" color="warning" />;
  }
  
  // Для портов и IP - показываем значение или Any
  if (['LocalPort', 'RemotePort', 'LocalIP', 'RemoteIP'].includes(columnId)) {
    if (!value || value === '0' || value === '' || value === '*') {
      return <Chip label="Any" size="small" variant="outlined" />;
    }
    return value;
  }
  
  // Для протокола
  if (columnId === 'Protocol') {
    if (!value || value === '0' || value === '' || value === '*') {
      return <Chip label="Any" size="small" variant="outlined" />;
    }
    return <Chip label={value} size="small" color="info" />;
  }
  
  // Для остальных полей - показываем как есть или пустое
  if (!value || value === '') {
    return '—';
  }
  
  return value;
}

function QoSPolicyRow({ policy, onEdit }) {
  return (
    <TableRow hover>
      {columns.map((column) => (
        <TableCell key={column.id} style={{ minWidth: column.minWidth }}>
          {column.id === 'actions' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton size="small" onClick={() => onEdit(policy)} color="primary">
                <EditIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Tooltip title={policy.keyPath || ''} arrow>
              <Box>
                {formatPolicyValue(policy[column.id], column.id)}
              </Box>
            </Tooltip>
          )}
        </TableCell>
      ))}
    </TableRow>
  );
}

function App() {
  const [policies, setPolicies] = useState([]);
  const [filteredPolicies, setFilteredPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Состояния для редактирования
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadPolicies = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await window.qosApi.getPolicies();
      
      if (!result.ok) {
        setError(result.error || 'Ошибка получения данных QoS политик');
        setPolicies([]);
        setFilteredPolicies([]);
        return;
      }

      if (!result.items || result.items.length === 0) {
        setError('Политики QoS не найдены в системе');
        setPolicies([]);
        setFilteredPolicies([]);
        return;
      }

      setPolicies(result.items);
      setFilteredPolicies(result.items);
    } catch (err) {
      setError(`Ошибка загрузки: ${err.message}`);
      setPolicies([]);
      setFilteredPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event) => {
    const value = event.target.value.toLowerCase();
    setSearchTerm(value);
    setPage(0);

    if (!value) {
      setFilteredPolicies(policies);
      return;
    }

    const filtered = policies.filter(policy =>
      Object.values(policy).some(val =>
        String(val || '').toLowerCase().includes(value)
      )
    );

    setFilteredPolicies(filtered);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setFilteredPolicies(policies);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleEdit = (policy) => {
    setCurrentPolicy(policy);
    setEditForm({
      Rule: policy.Rule || '',
      ApplicationName: policy.ApplicationName || '',
      DSCPValue: policy.DSCPValue || '0',
      ThrottleRate: policy.ThrottleRate || '-1',
      Protocol: policy.Protocol || '*',
      LocalIP: policy.LocalIP || '*',
      LocalIPPrefixLen: policy.LocalIPPrefixLen || '0',
      LocalPort: policy.LocalPort || '*',
      RemoteIP: policy.RemoteIP || '*',
      RemoteIPPrefixLen: policy.RemoteIPPrefixLen || '0',
      RemotePort: policy.RemotePort || '*',
      Version: policy.Version || '1.0'
    });
    setEditDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setEditDialogOpen(false);
    setCurrentPolicy(null);
    setEditForm({});
  };

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await window.qosApi.updatePolicy({
        ...currentPolicy,
        ...editForm
      });
      
      if (result.ok) {
        setSnackbar({ open: true, message: 'Политика успешно обновлена', severity: 'success' });
        handleCloseEdit();
        await loadPolicies(); // Перезагружаем данные
      } else {
        setSnackbar({ open: true, message: result.error || 'Ошибка сохранения', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Ошибка: ${err.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const paginatedPolicies = filteredPolicies.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <SettingsIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              QoS Policies Viewer
            </Typography>
            <Typography variant="body2" sx={{ mr: 2 }}>
              {filteredPolicies.length} политик найдено
            </Typography>
            <IconButton 
              color="inherit" 
              onClick={loadPolicies}
              disabled={loading}
            >
              <RefreshIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth={false} sx={{ mt: 2, mb: 2 }}>
          {error && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!error && (
            <Paper sx={{ mb: 2, p: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Поиск по всем полям..."
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton onClick={clearSearch} edge="end">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Paper>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
              <CircularProgress />
            </Box>
          ) : !error && filteredPolicies.length > 0 ? (
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      {columns.map((column) => (
                        <TableCell
                          key={column.id}
                          style={{ 
                            minWidth: column.minWidth,
                            backgroundColor: theme.palette.grey[100],
                            fontWeight: 'bold'
                          }}
                        >
                          {column.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedPolicies.map((policy, index) => (
                      <QoSPolicyRow 
                        key={`${policy.keyPath}-${index}`}
                        policy={policy}
                        onEdit={handleEdit}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredPolicies.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Строк на странице:"
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} из ${count !== -1 ? count : `более ${to}`}`
                }
              />
            </Paper>
          ) : null}
        </Container>

        {/* Dialog для редактирования */}
        <Dialog open={editDialogOpen} onClose={handleCloseEdit} maxWidth="md" fullWidth>
          <DialogTitle>
            Редактировать QoS политику: {currentPolicy?.Rule}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Название правила"
                  value={editForm.Rule || ''}
                  onChange={(e) => handleFormChange('Rule', e.target.value)}
                  disabled // Обычно не изменяем название
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Приложение"
                  value={editForm.ApplicationName || ''}
                  onChange={(e) => handleFormChange('ApplicationName', e.target.value)}
                  placeholder="Путь к приложению или *"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="DSCP значение"
                  type="number"
                  value={editForm.DSCPValue || ''}
                  onChange={(e) => handleFormChange('DSCPValue', e.target.value)}
                  inputProps={{ min: 0, max: 63 }}
                  helperText="0-63 или пусто для любого"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ограничение скорости (Kbps)"
                  type="number"
                  value={editForm.ThrottleRate || ''}
                  onChange={(e) => handleFormChange('ThrottleRate', e.target.value)}
                  helperText="-1 для неограниченной скорости"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Протокол</InputLabel>
                  <Select
                    value={editForm.Protocol || '*'}
                    label="Протокол"
                    onChange={(e) => handleFormChange('Protocol', e.target.value)}
                  >
                    <MenuItem value="*">Любой</MenuItem>
                    <MenuItem value="TCP">TCP</MenuItem>
                    <MenuItem value="UDP">UDP</MenuItem>
                    <MenuItem value="ICMP">ICMP</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Локальный порт"
                  value={editForm.LocalPort || ''}
                  onChange={(e) => handleFormChange('LocalPort', e.target.value)}
                  placeholder="* для любого порта"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Локальный IP"
                  value={editForm.LocalIP || ''}
                  onChange={(e) => handleFormChange('LocalIP', e.target.value)}
                  placeholder="* для любого IP"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Удаленный IP"
                  value={editForm.RemoteIP || ''}
                  onChange={(e) => handleFormChange('RemoteIP', e.target.value)}
                  placeholder="* для любого IP"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Удаленный порт"
                  value={editForm.RemotePort || ''}
                  onChange={(e) => handleFormChange('RemotePort', e.target.value)}
                  placeholder="* для любого порта"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEdit}>Отмена</Button>
            <Button 
              onClick={handleSave} 
              variant="contained" 
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar для уведомлений */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;