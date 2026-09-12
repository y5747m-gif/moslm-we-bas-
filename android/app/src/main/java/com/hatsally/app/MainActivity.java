package com.hatsally.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmPowerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
