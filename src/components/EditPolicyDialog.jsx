import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

const EditPolicyDialog = ({ open, policy, form, onChange, onClose, onSave, saving }) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle>
      Редактировать политику: {policy?.Rule}
    </DialogTitle>
    <DialogContent>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Название правила"
            value={form.Rule || ''}
            disabled
            helperText="Название правила нельзя изменить"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Приложение"
            value={form.ApplicationName || ''}
            onChange={(e) => onChange('ApplicationName', e.target.value)}
            placeholder="Путь к приложению или * для всех"
            helperText="Полный путь к .exe файлу или * для всех приложений"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="DSCP значение"
            type="number"
            value={form.DSCPValue || ''}
            onChange={(e) => onChange('DSCPValue', e.target.value)}
            inputProps={{ min: 0, max: 63 }}
            helperText="0-63 (0 = любое)"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Ограничение скорости"
            value={form.ThrottleRate || ''}
            onChange={(e) => onChange('ThrottleRate', e.target.value)}
            helperText="Примеры: 15 Mbps, 1000 Kbps, -1 (неограничено)"
            placeholder="15 Mbps или 15360 Kbps"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Протокол</InputLabel>
            <Select
              value={form.Protocol || '*'}
              label="Протокол"
              onChange={(e) => onChange('Protocol', e.target.value)}
            >
              <MenuItem value="*">Любой</MenuItem>
              <MenuItem value="TCP">TCP</MenuItem>
              <MenuItem value="UDP">UDP</MenuItem>
              <MenuItem value="Both">TCP и UDP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Локальный порт"
            value={form.LocalPort || ''}
            onChange={(e) => onChange('LocalPort', e.target.value)}
            placeholder="* для любого или диапазон (80:443)"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Локальный IP"
            value={form.LocalIP || ''}
            onChange={(e) => onChange('LocalIP', e.target.value)}
            placeholder="* для любого"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Префикс локального IP"
            type="number"
            value={form.LocalIPPrefixLength || ''}
            onChange={(e) => onChange('LocalIPPrefixLength', e.target.value)}
            inputProps={{ min: 0, max: 32 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Удаленный IP"
            value={form.RemoteIP || ''}
            onChange={(e) => onChange('RemoteIP', e.target.value)}
            placeholder="* для любого"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Префикс удаленного IP"
            type="number"
            value={form.RemoteIPPrefixLength || ''}
            onChange={(e) => onChange('RemoteIPPrefixLength', e.target.value)}
            inputProps={{ min: 0, max: 32 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Удаленный порт"
            value={form.RemotePort || ''}
            onChange={(e) => onChange('RemotePort', e.target.value)}
            placeholder="* для любого или диапазон"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Версия"
            value={form.Version || ''}
            onChange={(e) => onChange('Version', e.target.value)}
          />
        </Grid>
      </Grid>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Отмена</Button>
      <Button
        onClick={onSave}
        variant="contained"
        disabled={saving}
        startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
      >
        {saving ? 'Сохранение...' : 'Сохранить'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default EditPolicyDialog;
