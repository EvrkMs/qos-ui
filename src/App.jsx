import React, { useState, useEffect } from 'react';
import {
  ThemeProvider,
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
  Button,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  AdminPanelSettings as AdminIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import theme from './theme';
import { columns } from './constants/columns';
import QoSPolicyRow from './components/QoSPolicyRow';
import EditPolicyDialog from './components/EditPolicyDialog';
import CreatePolicyDialog from './components/CreatePolicyDialog';
import DeletePolicyDialog from './components/DeletePolicyDialog';
import NotificationSnackbar from './components/NotificationSnackbar';

function App() {
  const [policies, setPolicies] = useState([]);
  const [filteredPolicies, setFilteredPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Состояния для диалогов
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);

  // Проверка прав администратора
  const checkAdminRights = async () => {
    try {
      const adminStatus = await window.qosApi.checkAdmin();
      setIsAdmin(adminStatus);
    } catch {
      setIsAdmin(false);
    }
  };

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
        setError('');
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

  // Функции для редактирования
  const handleEdit = (policy) => {
    setCurrentPolicy(policy);
    
    // Конвертируем ThrottleRate в удобный формат для редактирования
    let throttleRateDisplay = policy.ThrottleRate || '-1';
    const throttleNum = parseInt(throttleRateDisplay, 10);
    
    if (!isNaN(throttleNum) && throttleNum > 0) {
      if (throttleNum >= 1000 && throttleNum % 1000 === 0) {
        // Если значение кратно 1000, показываем в Mbps
        throttleRateDisplay = `${throttleNum / 1000} Mbps`;
      } else if (throttleNum >= 1000) {
        // Если больше 1000 но не кратно, показываем с точностью
        throttleRateDisplay = `${(throttleNum / 1000).toFixed(1)} Mbps`;
      } else {
        throttleRateDisplay = `${throttleNum} Kbps`;
      }
    } else if (throttleNum === -1) {
      throttleRateDisplay = '-1';
    }
    
    setEditForm({
      Rule: policy.Rule || '',
      ApplicationName: policy.ApplicationName || '',
      DSCPValue: policy.DSCPValue || '0',
      ThrottleRate: throttleRateDisplay,
      Protocol: policy.Protocol || '*',
      LocalIP: policy.LocalIP || '*',
      LocalIPPrefixLength: policy.LocalIPPrefixLength || '0',
      LocalPort: policy.LocalPort || '*',
      RemoteIP: policy.RemoteIP || '*',
      RemoteIPPrefixLength: policy.RemoteIPPrefixLength || '0',
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
    // Специальная обработка для ThrottleRate
    if (field === 'ThrottleRate' && value) {
      const lowerValue = value.toLowerCase().trim();
      
      // Проверяем на mbps или mb
      if (lowerValue.includes('mbps') || lowerValue.includes('mb')) {
        const mbpsValue = parseFloat(lowerValue.replace(/[^0-9.]/g, ''));
        if (!isNaN(mbpsValue)) {
          // Конвертируем в Kbps
          value = String(Math.round(mbpsValue * 1000));
        }
      }
      // Проверяем на kbps или kb
      else if (lowerValue.includes('kbps') || lowerValue.includes('kb')) {
        const kbpsValue = parseFloat(lowerValue.replace(/[^0-9.]/g, ''));
        if (!isNaN(kbpsValue)) {
          value = String(Math.round(kbpsValue));
        }
      }
      // Если введено просто число больше 100, предполагаем что это Kbps
      else if (!isNaN(parseFloat(value))) {
        value = String(Math.round(parseFloat(value)));
      }
    }
    
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
        await loadPolicies();
      } else {
        setSnackbar({ open: true, message: result.error || 'Ошибка сохранения', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Ошибка: ${err.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Функции для удаления
  const handleDelete = (policy) => {
    setCurrentPolicy(policy);
    setDeleteDialogOpen(true);
  };

  const handleCloseDelete = () => {
    setDeleteDialogOpen(false);
    setCurrentPolicy(null);
  };

  const handleConfirmDelete = async () => {
    setSaving(true);
    try {
      const result = await window.qosApi.removeQosPolicyWin(currentPolicy.Rule);

      if (result.ok) {
        const msg = result.warning ? `Политика удалена: ${result.warning}` : 'Политика успешно удалена';
        const sev = result.warning ? 'warning' : 'success';
        setSnackbar({ open: true, message: msg, severity: sev });
        handleCloseDelete();
        await loadPolicies();
      } else {
        setSnackbar({ open: true, message: result.error || 'Ошибка удаления', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Ошибка: ${err.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Функции для создания
  const handleAddClick = (event) => {
    setAddMenuAnchor(event.currentTarget);
  };

  const handleAddClose = () => {
    setAddMenuAnchor(null);
  };

  const handleOpenWizard = async () => {
    handleAddClose();
    try {
      const res = await window.qosApi.openQosWizard();
      if (!res.ok) {
        setSnackbar({ open: true, message: res.error || 'Не удалось открыть мастер QoS', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: `Ошибка: ${err.message}`, severity: 'error' });
    }
  };

  const handleOpenCreateDialog = () => {
    handleAddClose();
    setEditForm({
      Rule: '',
      ApplicationName: '*',
      DSCPValue: '0',
      ThrottleRate: '-1',
      Protocol: '*',
      LocalIP: '*',
      LocalIPPrefixLength: '0',
      LocalPort: '*',
      RemoteIP: '*',
      RemoteIPPrefixLength: '0',
      RemotePort: '*',
      Version: '1.0',
      regView: '64'
    });
    setCreateDialogOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateDialogOpen(false);
    setEditForm({});
  };

  const handleSaveNew = async () => {
    if (!editForm.Rule || editForm.Rule.trim() === '') {
      setSnackbar({ open: true, message: 'Имя правила обязательно', severity: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const payload = { ...editForm, Name: editForm.Rule };
      const result = await window.qosApi.addQosPolicyWin(payload);
      
      if (result.ok) {
        setSnackbar({ open: true, message: 'Политика успешно создана', severity: 'success' });
        handleCloseCreate();
        await loadPolicies();
      } else {
        setSnackbar({ open: true, message: result.error || 'Ошибка создания', severity: 'error' });
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
    checkAdminRights();
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
              QoS Policies Manager
            </Typography>
            {isAdmin && (
              <Chip 
                icon={<AdminIcon />} 
                label="Администратор" 
                color="success" 
                sx={{ mr: 2 }}
              />
            )}
            <Typography variant="body2" sx={{ mr: 2 }}>
              {filteredPolicies.length} политик
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
          {!isAdmin && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
              Приложение запущено без прав администратора. Редактирование и удаление политик недоступно.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

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

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
              <CircularProgress />
            </Box>
          ) : filteredPolicies.length > 0 ? (
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
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
                        onDelete={handleDelete}
                        isAdmin={isAdmin}
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
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="textSecondary">
                Политики QoS не найдены
              </Typography>
              {isAdmin && (
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />} 
                  onClick={handleOpenCreateDialog}
                  sx={{ mt: 2 }}
                >
                  Создать политику
                </Button>
              )}
            </Paper>
          )}
        </Container>

        {/* Кнопка добавления */}
        {isAdmin && filteredPolicies.length > 0 && (
          <Fab
            color="primary"
            aria-label="add"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            onClick={handleAddClick}
          >
            <AddIcon />
          </Fab>
        )}
        {isAdmin && (
          <Menu anchorEl={addMenuAnchor} open={Boolean(addMenuAnchor)} onClose={handleAddClose}>
            <MenuItem onClick={handleOpenWizard}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Открыть мастер QoS</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleOpenCreateDialog}>
              <ListItemIcon>
                <AddIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Создать правило (PowerShell)</ListItemText>
            </MenuItem>
          </Menu>
        )}

        <EditPolicyDialog
          open={editDialogOpen}
          policy={currentPolicy}
          form={editForm}
          onChange={handleFormChange}
          onClose={handleCloseEdit}
          onSave={handleSave}
          saving={saving}
        />

        <CreatePolicyDialog
          open={createDialogOpen}
          form={editForm}
          onChange={handleFormChange}
          onClose={handleCloseCreate}
          onSave={handleSaveNew}
          saving={saving}
        />

        <DeletePolicyDialog
          open={deleteDialogOpen}
          policy={currentPolicy}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
          saving={saving}
        />
        <NotificationSnackbar
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          onClose={handleCloseSnackbar}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
