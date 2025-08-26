import React from 'react';
import {
  TableRow,
  TableCell,
  Box,
  IconButton,
  Chip,
  Tooltip,
  Typography,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { columns } from '../constants/columns';

function formatPolicyValue(value, columnId) {
  if (columnId === 'regView') {
    return <Chip label={`${value}-bit`} size="small" color={value === '64' ? 'primary' : 'secondary'} />;
  }

  if (columnId === 'DSCPValue') {
    const numValue = parseInt(value, 10);
    if (!value || value === '' || numValue === 0 || isNaN(numValue)) {
      return <Typography variant="body2" color="text.secondary">—</Typography>;
    }
    return <Chip label={`DSCP ${value}`} size="small" color="success" />;
  }

  if (columnId === 'ThrottleRate') {
    const numValue = parseInt(value, 10);
    if (!value || value === '' || numValue === -1 || numValue === 0 || isNaN(numValue)) {
      return <Chip label="Unlimited" size="small" variant="outlined" color="success" />;
    }

    if (numValue >= 1000) {
      const mbps = numValue / 1000;
      const mbpsStr = mbps % 1 === 0 ? mbps.toString() : mbps.toFixed(1);
      return <Chip label={`${mbpsStr} Mbps`} size="small" color="warning" />;
    }
    return <Chip label={`${numValue} Kbps`} size="small" color="warning" />;
  }

  if (['LocalPort', 'RemotePort', 'LocalIP', 'RemoteIP'].includes(columnId)) {
    if (!value || value === '0' || value === '' || value === '*') {
      return <Typography variant="body2" color="text.secondary">—</Typography>;
    }
    return (
      <Tooltip title={value}>
        <span>{value}</span>
      </Tooltip>
    );
  }

  if (columnId === 'Protocol') {
    if (!value || value === '0' || value === '' || value === '*') {
      return <Typography variant="body2" color="text.secondary">—</Typography>;
    }
    return <Chip label={value.toUpperCase()} size="small" color="info" />;
  }

  if (columnId === 'ApplicationName') {
    if (!value || value === '' || value === '*') {
      return <Typography variant="body2" color="text.secondary">—</Typography>;
    }
    const fileName = value.split('\\').pop();
    return (
      <Tooltip title={value} arrow>
        <span>{fileName}</span>
      </Tooltip>
    );
  }

  if (!value || value === '') {
    return '—';
  }

  return value;
}

export default function QoSPolicyRow({ policy, onEdit, onDelete, isAdmin }) {
  return (
    <TableRow hover>
      {columns.map((column) => (
        <TableCell key={column.id} style={{ minWidth: column.minWidth }}>
          {column.id === 'actions' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Редактировать">
                <IconButton
                  size="small"
                  onClick={() => onEdit(policy)}
                  color="primary"
                  disabled={!isAdmin}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Удалить">
                <IconButton
                  size="small"
                  onClick={() => onDelete(policy)}
                  color="error"
                  disabled={!isAdmin}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Tooltip
              title={column.id === 'Rule' ? policy.keyPath : ''}
              arrow
              disableHoverListener={column.id !== 'Rule'}
            >
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
